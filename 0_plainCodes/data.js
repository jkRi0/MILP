const DEFAULT_WORK_HOURS_PER_DAY = 7;
const DEFAULT_WORK_DAYS_PER_MONTH = 24;
const DEFAULT_MAX_OT_HOURS_PER_DAY = 4;

function buildMachineCalendar({ name, unitCapacityPerMonth, workHoursPerDay, workDaysPerMonth, maxOtHoursPerDay }) {
  const wh = Number.isFinite(workHoursPerDay) ? workHoursPerDay : DEFAULT_WORK_HOURS_PER_DAY;
  const wd = Number.isFinite(workDaysPerMonth) ? workDaysPerMonth : DEFAULT_WORK_DAYS_PER_MONTH;
  const otH = Number.isFinite(maxOtHoursPerDay) ? maxOtHoursPerDay : DEFAULT_MAX_OT_HOURS_PER_DAY;

  // Apply both daily and monthly calendars where applicable:
  // - Daily minutes: used for communicating the calendar assumptions (7h/day + OT policy).
  // - Monthly minutes: used by the scheduler because the UI planning bucket is a calendar month.
  const A_day_min = wh * 60;
  const OT_day_max = otH * 60;
  const A_min = A_day_min * wd;
  const OT_max = OT_day_max * wd;

  return {
    name,
    unitCapacityPerMonth,
    workHoursPerDay: wh,
    workDaysPerMonth: wd,
    maxOtHoursPerDay: otH,
    A_day_min,
    OT_day_max,
    // These are the values used by the solver (planning period = month)
    A_min,
    OT_max
  };
}

const MACHINES = [
  buildMachineCalendar({ name: 'Turret Machine 1', unitCapacityPerMonth: 33484, workHoursPerDay: 7, workDaysPerMonth: 24, maxOtHoursPerDay: 4 }),
  buildMachineCalendar({ name: 'Turret Machine 2', unitCapacityPerMonth: 38278, workHoursPerDay: 7, workDaysPerMonth: 24, maxOtHoursPerDay: 4 }),
  buildMachineCalendar({ name: 'Turret Machine 3', unitCapacityPerMonth: 10444, workHoursPerDay: 7, workDaysPerMonth: 24, maxOtHoursPerDay: 4 }),
  buildMachineCalendar({ name: 'Arc Welding Machine', unitCapacityPerMonth: 17126, workHoursPerDay: 7, workDaysPerMonth: 24, maxOtHoursPerDay: 4 }),
  buildMachineCalendar({ name: 'Spot Weld 1', unitCapacityPerMonth: 10636, workHoursPerDay: 7, workDaysPerMonth: 24, maxOtHoursPerDay: 4 }),
  buildMachineCalendar({ name: 'Spot Weld 2', unitCapacityPerMonth: 11744, workHoursPerDay: 7, workDaysPerMonth: 24, maxOtHoursPerDay: 4 })
];

const PART_SIZES = {
  AC001: '974 mm × 374.5 mm',
  AC002: '416.2 × 335.2',
  AC003: '416.2 × 335.2',
  AC004: '346.5 × 268.5 mm',
  AC005: '185 × 184 mm',
  AC006: '25 × 174.7',
  AC007: '967 × 367',
  AC008: '120.2 × 40',
  AC009: '221.50 × 221.50 mm',
  AC010: '221.50 × 221.50 mm',
  AC011: '423.9 × 403.8 mm',
  AC012: '521.8 × 475.4 mm',
  AC013: '536.5 × 414.9 mm',
  AC014: '180 × 138.4 mm',
  AC015: '524.8 × 237.1 mm',
  AC016: '372.8 × 363.7 mm',
  AC017: '454.6 × 323.4 mm',
  AC018: '332.94 × 405.27',
  AC019: '160 × 110.4',
  AC020: '239.7 × 218.6',
  AC021: '708.5 × 1064.5',
  AC022: '226 × 65.5',
  AC023: '355 × 300',
  AC024: '219.48 × 293.55',
  AC025: '220 × 160',
  AC026: '798.6 × 331.7',
  AC027: '372.7 × 363.7',
  AC028: '366.4 × 528.2 mm',
  AC029: '177.5 × 600.4',
  AC030: '515 × 100 mm',
  AC031: '320 × 170',
  AC032: '500 × 400 mm',
  AC033: '576 × 425 mm',
  AC034: '506 × 505 mm',
  AC035: '577.4 × 67.7 mm',
  AC036: '647 × 127.4 mm',
  AC037: '647 × 127.4 mm',
  AC038: '425.4 × 453 mm',
  AC039: '250.5 × 318 mm',
  AC040: '70 × 181.9 mm',
  AC041: '202.5 × 119.1 mm',
  AC042: '1820.4 × 1025 mm',
  AC043: '1820.5 × 1025.2 mm',
  AC044: '329.1 × 220.4 mm',
  AC045: '329.1 × 220.4 mm',
  AC046: '648.2 × 216',
  AC047: '1781.4 × 410.9',
  AC048: '1781.4 × 410.9',
  AC049: '610.3 × 413.4',
  AC050: '810 × 162.8',
  AC051: '810 × 162.8',
  AC052: '686 × 196 mm',
  AC053: '570 × 148',
  AC054: '570 × 154.7 mm',
  AC055: '176 × 439.6',
  AC056: '538.1 × 116.2',
  AC057: '552.1 × 193.8',
  AC058: '312.8 × 211.8',
  AC059: '457.8 × 280.2 mm',
  AC060: '572.5 × 216.9 mm',
  AC061: '506.2 × 187.7 mm',
  AC062: '568.00 × 650.50 mm',
  AC063: '557.6 mm × 411'
};

const MACHINE_ROUTE = typeof window !== 'undefined' && window.MACHINE_ROUTE_FULL ? window.MACHINE_ROUTE_FULL : {};

// routingLong[partCode][operation] = [{ machine, pi_ij }, ...]
// - pi_ij: 0 means PRIMARY, 1 means ALTERNATIVE
// NOTE: Only a minimal subset is populated here to keep the demo runnable.
// Expand this object with the full Routing_Long data from Excel.
const ROUTING_LONG =
  typeof window !== 'undefined' && window.ROUTING_LONG_FULL
    ? window.ROUTING_LONG_FULL
    : {
        AC001: {
          Op1: [
            { machine: 'Arc Welding Machine', pi_ij: 0 }
            // Add eligible turret/spot machines for AC001 here if they are required operations
          ]
        },
        AC002: {
          Op1: [{ machine: 'Spot Weld 2', pi_ij: 0 }]
        }
      };

// times[partCode][operation][machine] = { unit_time_min_per_unit, setup_time_min }
// NOTE: Only a minimal subset is populated here to keep the demo runnable.
// Expand this object with the full Times sheet from Excel.
const TIMES =
  typeof window !== 'undefined' && window.TIMES_FULL
    ? window.TIMES_FULL
    : {
        AC001: {
          Op1: {
            'Arc Welding Machine': { unit_time_min_per_unit: 1.77, setup_time_min: 3.67 }
          }
        },
        AC002: {
          Op1: {
            'Spot Weld 2': { unit_time_min_per_unit: 0.82, setup_time_min: 6.51 }
          }
        }
      };
