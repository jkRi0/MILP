-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Feb 10, 2026 at 02:03 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `milp`
--

-- --------------------------------------------------------

--
-- Table structure for table `optimize_history`
--

CREATE TABLE `optimize_history` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED DEFAULT NULL,
  `note` varchar(255) NOT NULL DEFAULT '',
  `base_year` int(11) NOT NULL,
  `before_orders_json` longtext NOT NULL,
  `after_orders_json` longtext NOT NULL,
  `before_util_json` longtext DEFAULT NULL,
  `after_util_json` longtext DEFAULT NULL,
  `created_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `optimize_history`
--

INSERT INTO `optimize_history` (`id`, `user_id`, `note`, `base_year`, `before_orders_json`, `after_orders_json`, `before_util_json`, `after_util_json`, `created_at`) VALUES
(1, 1, 'Global re-optimization', 2026, '[{\"id\":1770540339953,\"order_id\":\"O26-S9953\",\"part_code\":\"AC002\",\"quantity\":6994,\"month\":\"2026-04\",\"priority\":\"normal\",\"created_at\":\"2026-02-08T00:44:57.000Z\"},{\"id\":1770540170588,\"order_id\":\"O33-S0588\",\"part_code\":\"AC028\",\"quantity\":7590,\"month\":\"2026-04\",\"priority\":\"normal\",\"created_at\":\"2026-02-08T00:41:21.000Z\"},{\"id\":1770540051242,\"order_id\":\"O33\",\"part_code\":\"AC028\",\"quantity\":2409,\"month\":\"2026-03\",\"priority\":\"normal\",\"created_at\":\"2026-02-08T00:40:51.000Z\"},{\"id\":1770540096578,\"order_id\":\"O32-S6578\",\"part_code\":\"AC028\",\"quantity\":3792,\"month\":\"2026-03\",\"priority\":\"normal\",\"created_at\":\"2026-02-08T00:40:18.000Z\"},{\"id\":1770540017984,\"order_id\":\"O32\",\"part_code\":\"AC028\",\"quantity\":6207,\"month\":\"2026-02\",\"priority\":\"normal\",\"created_at\":\"2026-02-08T00:40:17.000Z\"},{\"id\":1770531800209,\"order_id\":\"O31\",\"part_code\":\"AC002\",\"quantity\":111,\"month\":\"2026-03\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T22:23:20.000Z\"},{\"id\":1770522981395,\"order_id\":\"O30\",\"part_code\":\"AC002\",\"quantity\":9,\"month\":\"2026-02\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T19:56:21.000Z\"},{\"id\":1770522454350,\"order_id\":\"O29\",\"part_code\":\"AC002\",\"quantity\":50,\"month\":\"2026-02\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T19:47:34.000Z\"},{\"id\":1770522375963,\"order_id\":\"O28\",\"part_code\":\"AC002\",\"quantity\":1000,\"month\":\"2026-03\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T19:46:15.000Z\"},{\"id\":1770516523247,\"order_id\":\"O27\",\"part_code\":\"AC002\",\"quantity\":1000,\"month\":\"2026-03\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T18:08:43.000Z\"},{\"id\":1770515687294,\"order_id\":\"O26\",\"part_code\":\"AC002\",\"quantity\":3006,\"month\":\"2026-03\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T17:54:47.000Z\"},{\"id\":1770513263947,\"order_id\":\"O25\",\"part_code\":\"AC006\",\"quantity\":1000,\"month\":\"2026-03\",\"priority\":\"high\",\"created_at\":\"2026-02-07T17:14:23.000Z\"},{\"id\":1770513132650,\"order_id\":\"O24\",\"part_code\":\"AC013\",\"quantity\":12,\"month\":\"2026-02\",\"priority\":\"low\",\"created_at\":\"2026-02-07T17:12:12.000Z\"},{\"id\":1770510725613,\"order_id\":\"O23\",\"part_code\":\"AC013\",\"quantity\":5000,\"month\":\"2026-02\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T16:32:05.000Z\"},{\"id\":1770510676127,\"order_id\":\"O22\",\"part_code\":\"AC005\",\"quantity\":300,\"month\":\"2026-02\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T16:31:16.000Z\"},{\"id\":1770510654408,\"order_id\":\"O21\",\"part_code\":\"AC004\",\"quantity\":2000,\"month\":\"2026-02\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T16:30:54.000Z\"},{\"id\":1770510604427,\"order_id\":\"O20\",\"part_code\":\"AC063\",\"quantity\":620,\"month\":\"2026-02\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T16:30:04.000Z\"},{\"id\":1770510586402,\"order_id\":\"O19\",\"part_code\":\"AC013\",\"quantity\":100,\"month\":\"2026-02\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T16:29:46.000Z\"},{\"id\":1770510525993,\"order_id\":\"O18\",\"part_code\":\"AC011\",\"quantity\":12500,\"month\":\"2026-02\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T16:28:45.000Z\"},{\"id\":1770510505794,\"order_id\":\"O17\",\"part_code\":\"AC007\",\"quantity\":5000,\"month\":\"2026-02\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T16:28:25.000Z\"},{\"id\":1770510491976,\"order_id\":\"O16\",\"part_code\":\"AC006\",\"quantity\":3200,\"month\":\"2026-02\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T16:28:11.000Z\"},{\"id\":1770510421232,\"order_id\":\"O15\",\"part_code\":\"AC050\",\"quantity\":1200,\"month\":\"2026-02\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T16:27:01.000Z\"},{\"id\":1770468847684,\"order_id\":\"O14\",\"part_code\":\"AC007\",\"quantity\":50000,\"month\":\"2026-06\",\"priority\":\"high\",\"created_at\":\"2026-02-07T04:54:07.000Z\"}]', '[{\"id\":1770510525993,\"order_id\":\"O18\",\"part_code\":\"AC011\",\"quantity\":12500,\"month\":\"2026-02\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T16:28:45.000Z\"},{\"id\":1770510421232,\"order_id\":\"O15\",\"part_code\":\"AC050\",\"quantity\":1200,\"month\":\"2026-03\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T16:27:01.000Z\"},{\"id\":1770510491976,\"order_id\":\"O16\",\"part_code\":\"AC006\",\"quantity\":3200,\"month\":\"2026-03\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T16:28:11.000Z\"},{\"id\":1770510505794,\"order_id\":\"O17\",\"part_code\":\"AC007\",\"quantity\":5000,\"month\":\"2026-03\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T16:28:25.000Z\"},{\"id\":1770510586402,\"order_id\":\"O19\",\"part_code\":\"AC013\",\"quantity\":100,\"month\":\"2026-03\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T16:29:46.000Z\"},{\"id\":1770510676127,\"order_id\":\"O22\",\"part_code\":\"AC005\",\"quantity\":300,\"month\":\"2026-03\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T16:31:16.000Z\"},{\"id\":1770522454350,\"order_id\":\"O29\",\"part_code\":\"AC002\",\"quantity\":50,\"month\":\"2026-03\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T19:47:34.000Z\"},{\"id\":1770522981395,\"order_id\":\"O30\",\"part_code\":\"AC002\",\"quantity\":9,\"month\":\"2026-03\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T19:56:21.000Z\"},{\"id\":1770540017984,\"order_id\":\"O32\",\"part_code\":\"AC028\",\"quantity\":6207,\"month\":\"2026-03\",\"priority\":\"normal\",\"created_at\":\"2026-02-08T00:40:17.000Z\"},{\"id\":1770513132650,\"order_id\":\"O24\",\"part_code\":\"AC013\",\"quantity\":12,\"month\":\"2026-03\",\"priority\":\"low\",\"created_at\":\"2026-02-07T17:12:12.000Z\"},{\"id\":1770513263947,\"order_id\":\"O25\",\"part_code\":\"AC006\",\"quantity\":1000,\"month\":\"2026-04\",\"priority\":\"high\",\"created_at\":\"2026-02-07T17:14:23.000Z\"},{\"id\":1770510604427,\"order_id\":\"O20\",\"part_code\":\"AC063\",\"quantity\":620,\"month\":\"2026-04\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T16:30:04.000Z\"},{\"id\":1770510654408,\"order_id\":\"O21\",\"part_code\":\"AC004\",\"quantity\":2000,\"month\":\"2026-04\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T16:30:54.000Z\"},{\"id\":1770515687294,\"order_id\":\"O26\",\"part_code\":\"AC002\",\"quantity\":3006,\"month\":\"2026-04\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T17:54:47.000Z\"},{\"id\":1770516523247,\"order_id\":\"O27\",\"part_code\":\"AC002\",\"quantity\":1000,\"month\":\"2026-04\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T18:08:43.000Z\"},{\"id\":1770531800209,\"order_id\":\"O31\",\"part_code\":\"AC002\",\"quantity\":111,\"month\":\"2026-04\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T22:23:20.000Z\"},{\"id\":1770540096578,\"order_id\":\"O32-S6578\",\"part_code\":\"AC028\",\"quantity\":3792,\"month\":\"2026-04\",\"priority\":\"normal\",\"created_at\":\"2026-02-08T00:40:18.000Z\"},{\"id\":1770540051242,\"order_id\":\"O33\",\"part_code\":\"AC028\",\"quantity\":2409,\"month\":\"2026-04\",\"priority\":\"normal\",\"created_at\":\"2026-02-08T00:40:51.000Z\"},{\"id\":1770510725613,\"order_id\":\"O23\",\"part_code\":\"AC013\",\"quantity\":5000,\"month\":\"2026-05\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T16:32:05.000Z\"},{\"id\":1770540170588,\"order_id\":\"O33-S0588\",\"part_code\":\"AC028\",\"quantity\":6207,\"month\":\"2026-05\",\"priority\":\"normal\",\"created_at\":\"2026-02-08T00:41:21.000Z\"},{\"id\":1770468847684,\"order_id\":\"O14\",\"part_code\":\"AC007\",\"quantity\":50000,\"month\":\"2026-06\",\"priority\":\"high\",\"created_at\":\"2026-02-07T04:54:07.000Z\"},{\"id\":1770542041278,\"order_id\":\"O33-S0588-S1278\",\"part_code\":\"AC028\",\"quantity\":1383,\"month\":\"2026-06\",\"priority\":\"normal\",\"created_at\":\"2026-02-08T00:41:21.000Z\"},{\"id\":1770522375963,\"order_id\":\"O28\",\"part_code\":\"AC002\",\"quantity\":1000,\"month\":\"2026-07\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T19:46:15.000Z\"},{\"id\":1770540339953,\"order_id\":\"O26-S9953\",\"part_code\":\"AC002\",\"quantity\":5123,\"month\":\"2026-08\",\"priority\":\"normal\",\"created_at\":\"2026-02-08T00:44:57.000Z\"},{\"id\":1770542023392,\"order_id\":\"O26-S9953-S3392\",\"part_code\":\"AC002\",\"quantity\":1871,\"month\":\"2026-09\",\"priority\":\"normal\",\"created_at\":\"2026-02-08T00:44:57.000Z\"}]', '{\"2026-01\":{\"Turret Machine 1\":0,\"Turret Machine 2\":0,\"Turret Machine 3\":0,\"Arc Welding Machine\":0,\"Spot Weld 1\":0,\"Spot Weld 2\":0},\"2026-02\":{\"Turret Machine 1\":149.59285714285713,\"Turret Machine 2\":134.80565476190475,\"Turret Machine 3\":89.99265873015874,\"Arc Welding Machine\":123.01349206349205,\"Spot Weld 1\":11.61686507936508,\"Spot Weld 2\":0.6091269841269841},\"2026-03\":{\"Turret Machine 1\":77.53333333333335,\"Turret Machine 2\":17.74077380952381,\"Turret Machine 3\":89.9954365079365,\"Arc Welding Machine\":89.99771825396826,\"Spot Weld 1\":0,\"Spot Weld 2\":41.88472222222222},\"2026-04\":{\"Turret Machine 1\":105.55813492063493,\"Turret Machine 2\":0,\"Turret Machine 3\":110.02420634920635,\"Arc Welding Machine\":122.84771825396828,\"Spot Weld 1\":0,\"Spot Weld 2\":56.96021825396825},\"2026-05\":{\"Turret Machine 1\":0,\"Turret Machine 2\":0,\"Turret Machine 3\":0,\"Arc Welding Machine\":0,\"Spot Weld 1\":0,\"Spot Weld 2\":0},\"2026-06\":{\"Turret Machine 1\":0,\"Turret Machine 2\":0,\"Turret Machine 3\":0,\"Arc Welding Machine\":0,\"Spot Weld 1\":0,\"Spot Weld 2\":0},\"2026-07\":{\"Turret Machine 1\":0,\"Turret Machine 2\":0,\"Turret Machine 3\":0,\"Arc Welding Machine\":0,\"Spot Weld 1\":0,\"Spot Weld 2\":0},\"2026-08\":{\"Turret Machine 1\":0,\"Turret Machine 2\":0,\"Turret Machine 3\":0,\"Arc Welding Machine\":0,\"Spot Weld 1\":0,\"Spot Weld 2\":0},\"2026-09\":{\"Turret Machine 1\":0,\"Turret Machine 2\":0,\"Turret Machine 3\":0,\"Arc Welding Machine\":0,\"Spot Weld 1\":0,\"Spot Weld 2\":0},\"2026-10\":{\"Turret Machine 1\":0,\"Turret Machine 2\":0,\"Turret Machine 3\":0,\"Arc Welding Machine\":0,\"Spot Weld 1\":0,\"Spot Weld 2\":0},\"2026-11\":{\"Turret Machine 1\":0,\"Turret Machine 2\":0,\"Turret Machine 3\":0,\"Arc Welding Machine\":0,\"Spot Weld 1\":0,\"Spot Weld 2\":0},\"2026-12\":{\"Turret Machine 1\":0,\"Turret Machine 2\":0,\"Turret Machine 3\":0,\"Arc Welding Machine\":0,\"Spot Weld 1\":0,\"Spot Weld 2\":0}}', '{\"2026-01\":{\"Turret Machine 1\":0,\"Turret Machine 2\":0,\"Turret Machine 3\":0,\"Arc Welding Machine\":0,\"Spot Weld 1\":0,\"Spot Weld 2\":0},\"2026-02\":{\"Turret Machine 1\":0,\"Turret Machine 2\":0,\"Turret Machine 3\":0,\"Arc Welding Machine\":0,\"Spot Weld 1\":0,\"Spot Weld 2\":0},\"2026-03\":{\"Turret Machine 1\":74.1029761904762,\"Turret Machine 2\":88.37569444444445,\"Turret Machine 3\":89.99265873015874,\"Arc Welding Machine\":24.256150793650793,\"Spot Weld 1\":11.61686507936508,\"Spot Weld 2\":0.6091269841269841},\"2026-04\":{\"Turret Machine 1\":77.53333333333335,\"Turret Machine 2\":46.42996031746031,\"Turret Machine 3\":89.9954365079365,\"Arc Welding Machine\":83.32509920634921,\"Spot Weld 1\":0,\"Spot Weld 2\":33.685218253968266},\"2026-05\":{\"Turret Machine 1\":75.48988095238094,\"Turret Machine 2\":0,\"Turret Machine 3\":89.99265873015874,\"Arc Welding Machine\":87.83402777777778,\"Spot Weld 1\":0,\"Spot Weld 2\":0},\"2026-06\":{\"Turret Machine 1\":0,\"Turret Machine 2\":0,\"Turret Machine 3\":20.121230158730157,\"Arc Welding Machine\":0,\"Spot Weld 1\":0,\"Spot Weld 2\":0},\"2026-07\":{\"Turret Machine 1\":15.172420634920636,\"Turret Machine 2\":0,\"Turret Machine 3\":0,\"Arc Welding Machine\":17.59593253968254,\"Spot Weld 1\":0,\"Spot Weld 2\":8.199503968253968},\"2026-08\":{\"Turret Machine 1\":77.34464285714286,\"Turret Machine 2\":0,\"Turret Machine 3\":0,\"Arc Welding Machine\":89.99384920634922,\"Spot Weld 1\":0,\"Spot Weld 2\":41.739781746031746},\"2026-09\":{\"Turret Machine 1\":28.306547619047624,\"Turret Machine 2\":0,\"Turret Machine 3\":0,\"Arc Welding Machine\":32.890277777777776,\"Spot Weld 1\":0,\"Spot Weld 2\":15.28501984126984},\"2026-10\":{\"Turret Machine 1\":0,\"Turret Machine 2\":0,\"Turret Machine 3\":0,\"Arc Welding Machine\":0,\"Spot Weld 1\":0,\"Spot Weld 2\":0},\"2026-11\":{\"Turret Machine 1\":0,\"Turret Machine 2\":0,\"Turret Machine 3\":0,\"Arc Welding Machine\":0,\"Spot Weld 1\":0,\"Spot Weld 2\":0},\"2026-12\":{\"Turret Machine 1\":0,\"Turret Machine 2\":0,\"Turret Machine 3\":0,\"Arc Welding Machine\":0,\"Spot Weld 1\":0,\"Spot Weld 2\":0}}', '2026-02-08 10:13:11'),
(2, 1, 'Global re-optimization', 2026, '[{\"id\":1770540339953,\"order_id\":\"O26-S9953\",\"part_code\":\"AC002\",\"quantity\":6994,\"month\":\"2026-04\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T16:44:57.000Z\"},{\"id\":1770540170588,\"order_id\":\"O33-S0588\",\"part_code\":\"AC028\",\"quantity\":7590,\"month\":\"2026-04\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T16:41:21.000Z\"},{\"id\":1770540051242,\"order_id\":\"O33\",\"part_code\":\"AC028\",\"quantity\":2409,\"month\":\"2026-03\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T16:40:51.000Z\"},{\"id\":1770540096578,\"order_id\":\"O32-S6578\",\"part_code\":\"AC028\",\"quantity\":3792,\"month\":\"2026-03\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T16:40:18.000Z\"},{\"id\":1770540017984,\"order_id\":\"O32\",\"part_code\":\"AC028\",\"quantity\":6207,\"month\":\"2026-02\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T16:40:17.000Z\"},{\"id\":1770531800209,\"order_id\":\"O31\",\"part_code\":\"AC002\",\"quantity\":111,\"month\":\"2026-03\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T14:23:20.000Z\"},{\"id\":1770522981395,\"order_id\":\"O30\",\"part_code\":\"AC002\",\"quantity\":9,\"month\":\"2026-02\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T11:56:21.000Z\"},{\"id\":1770522454350,\"order_id\":\"O29\",\"part_code\":\"AC002\",\"quantity\":50,\"month\":\"2026-02\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T11:47:34.000Z\"},{\"id\":1770522375963,\"order_id\":\"O28\",\"part_code\":\"AC002\",\"quantity\":1000,\"month\":\"2026-03\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T11:46:15.000Z\"},{\"id\":1770516523247,\"order_id\":\"O27\",\"part_code\":\"AC002\",\"quantity\":1000,\"month\":\"2026-03\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T10:08:43.000Z\"},{\"id\":1770515687294,\"order_id\":\"O26\",\"part_code\":\"AC002\",\"quantity\":3006,\"month\":\"2026-03\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T09:54:47.000Z\"},{\"id\":1770513263947,\"order_id\":\"O25\",\"part_code\":\"AC006\",\"quantity\":1000,\"month\":\"2026-03\",\"priority\":\"high\",\"created_at\":\"2026-02-07T09:14:23.000Z\"},{\"id\":1770513132650,\"order_id\":\"O24\",\"part_code\":\"AC013\",\"quantity\":12,\"month\":\"2026-02\",\"priority\":\"low\",\"created_at\":\"2026-02-07T09:12:12.000Z\"},{\"id\":1770510725613,\"order_id\":\"O23\",\"part_code\":\"AC013\",\"quantity\":5000,\"month\":\"2026-02\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T08:32:05.000Z\"},{\"id\":1770510676127,\"order_id\":\"O22\",\"part_code\":\"AC005\",\"quantity\":300,\"month\":\"2026-02\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T08:31:16.000Z\"},{\"id\":1770510654408,\"order_id\":\"O21\",\"part_code\":\"AC004\",\"quantity\":2000,\"month\":\"2026-02\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T08:30:54.000Z\"},{\"id\":1770510604427,\"order_id\":\"O20\",\"part_code\":\"AC063\",\"quantity\":620,\"month\":\"2026-02\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T08:30:04.000Z\"},{\"id\":1770510586402,\"order_id\":\"O19\",\"part_code\":\"AC013\",\"quantity\":100,\"month\":\"2026-02\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T08:29:46.000Z\"},{\"id\":1770510525993,\"order_id\":\"O18\",\"part_code\":\"AC011\",\"quantity\":12500,\"month\":\"2026-02\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T08:28:45.000Z\"},{\"id\":1770510505794,\"order_id\":\"O17\",\"part_code\":\"AC007\",\"quantity\":5000,\"month\":\"2026-02\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T08:28:25.000Z\"},{\"id\":1770510491976,\"order_id\":\"O16\",\"part_code\":\"AC006\",\"quantity\":3200,\"month\":\"2026-02\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T08:28:11.000Z\"},{\"id\":1770510421232,\"order_id\":\"O15\",\"part_code\":\"AC050\",\"quantity\":1200,\"month\":\"2026-02\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T08:27:01.000Z\"},{\"id\":1770468847684,\"order_id\":\"O14\",\"part_code\":\"AC007\",\"quantity\":50000,\"month\":\"2026-06\",\"priority\":\"high\",\"created_at\":\"2026-02-06T20:54:07.000Z\"}]', '[{\"id\":1770510525993,\"order_id\":\"O18\",\"part_code\":\"AC011\",\"quantity\":12500,\"month\":\"2026-02\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T08:28:45.000Z\"},{\"id\":1770510421232,\"order_id\":\"O15\",\"part_code\":\"AC050\",\"quantity\":1200,\"month\":\"2026-03\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T08:27:01.000Z\"},{\"id\":1770510491976,\"order_id\":\"O16\",\"part_code\":\"AC006\",\"quantity\":3200,\"month\":\"2026-03\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T08:28:11.000Z\"},{\"id\":1770510505794,\"order_id\":\"O17\",\"part_code\":\"AC007\",\"quantity\":5000,\"month\":\"2026-03\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T08:28:25.000Z\"},{\"id\":1770510586402,\"order_id\":\"O19\",\"part_code\":\"AC013\",\"quantity\":100,\"month\":\"2026-03\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T08:29:46.000Z\"},{\"id\":1770510676127,\"order_id\":\"O22\",\"part_code\":\"AC005\",\"quantity\":300,\"month\":\"2026-03\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T08:31:16.000Z\"},{\"id\":1770522454350,\"order_id\":\"O29\",\"part_code\":\"AC002\",\"quantity\":50,\"month\":\"2026-03\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T11:47:34.000Z\"},{\"id\":1770522981395,\"order_id\":\"O30\",\"part_code\":\"AC002\",\"quantity\":9,\"month\":\"2026-03\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T11:56:21.000Z\"},{\"id\":1770540017984,\"order_id\":\"O32\",\"part_code\":\"AC028\",\"quantity\":6207,\"month\":\"2026-03\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T16:40:17.000Z\"},{\"id\":1770513132650,\"order_id\":\"O24\",\"part_code\":\"AC013\",\"quantity\":12,\"month\":\"2026-03\",\"priority\":\"low\",\"created_at\":\"2026-02-07T09:12:12.000Z\"},{\"id\":1770513263947,\"order_id\":\"O25\",\"part_code\":\"AC006\",\"quantity\":1000,\"month\":\"2026-04\",\"priority\":\"high\",\"created_at\":\"2026-02-07T09:14:23.000Z\"},{\"id\":1770510604427,\"order_id\":\"O20\",\"part_code\":\"AC063\",\"quantity\":620,\"month\":\"2026-04\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T08:30:04.000Z\"},{\"id\":1770510654408,\"order_id\":\"O21\",\"part_code\":\"AC004\",\"quantity\":2000,\"month\":\"2026-04\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T08:30:54.000Z\"},{\"id\":1770515687294,\"order_id\":\"O26\",\"part_code\":\"AC002\",\"quantity\":3006,\"month\":\"2026-04\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T09:54:47.000Z\"},{\"id\":1770516523247,\"order_id\":\"O27\",\"part_code\":\"AC002\",\"quantity\":1000,\"month\":\"2026-04\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T10:08:43.000Z\"},{\"id\":1770531800209,\"order_id\":\"O31\",\"part_code\":\"AC002\",\"quantity\":111,\"month\":\"2026-04\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T14:23:20.000Z\"},{\"id\":1770540096578,\"order_id\":\"O32-S6578\",\"part_code\":\"AC028\",\"quantity\":3792,\"month\":\"2026-04\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T16:40:18.000Z\"},{\"id\":1770540051242,\"order_id\":\"O33\",\"part_code\":\"AC028\",\"quantity\":2409,\"month\":\"2026-04\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T16:40:51.000Z\"},{\"id\":1770510725613,\"order_id\":\"O23\",\"part_code\":\"AC013\",\"quantity\":5000,\"month\":\"2026-05\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T08:32:05.000Z\"},{\"id\":1770540170588,\"order_id\":\"O33-S0588\",\"part_code\":\"AC028\",\"quantity\":6207,\"month\":\"2026-05\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T16:41:21.000Z\"},{\"id\":1770468847684,\"order_id\":\"O14\",\"part_code\":\"AC007\",\"quantity\":50000,\"month\":\"2026-06\",\"priority\":\"high\",\"created_at\":\"2026-02-06T20:54:07.000Z\"},{\"id\":1770542406888,\"order_id\":\"O33-S0588-S6888\",\"part_code\":\"AC028\",\"quantity\":1383,\"month\":\"2026-06\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T16:41:21.000Z\"},{\"id\":1770522375963,\"order_id\":\"O28\",\"part_code\":\"AC002\",\"quantity\":1000,\"month\":\"2026-07\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T11:46:15.000Z\"},{\"id\":1770540339953,\"order_id\":\"O26-S9953\",\"part_code\":\"AC002\",\"quantity\":5123,\"month\":\"2026-08\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T16:44:57.000Z\"},{\"id\":1770542434357,\"order_id\":\"O26-S9953-S4357\",\"part_code\":\"AC002\",\"quantity\":1871,\"month\":\"2026-09\",\"priority\":\"normal\",\"created_at\":\"2026-02-07T16:44:57.000Z\"}]', '{\"2026-01\":{\"Turret Machine 1\":0,\"Turret Machine 2\":0,\"Turret Machine 3\":0,\"Arc Welding Machine\":0,\"Spot Weld 1\":0,\"Spot Weld 2\":0},\"2026-02\":{\"Turret Machine 1\":149.59285714285713,\"Turret Machine 2\":134.80565476190475,\"Turret Machine 3\":89.99265873015874,\"Arc Welding Machine\":123.01349206349205,\"Spot Weld 1\":11.61686507936508,\"Spot Weld 2\":0.6091269841269841},\"2026-03\":{\"Turret Machine 1\":77.53333333333335,\"Turret Machine 2\":17.74077380952381,\"Turret Machine 3\":89.9954365079365,\"Arc Welding Machine\":89.99771825396826,\"Spot Weld 1\":0,\"Spot Weld 2\":41.88472222222222},\"2026-04\":{\"Turret Machine 1\":105.55813492063493,\"Turret Machine 2\":0,\"Turret Machine 3\":110.02420634920635,\"Arc Welding Machine\":122.84771825396828,\"Spot Weld 1\":0,\"Spot Weld 2\":56.96021825396825},\"2026-05\":{\"Turret Machine 1\":0,\"Turret Machine 2\":0,\"Turret Machine 3\":0,\"Arc Welding Machine\":0,\"Spot Weld 1\":0,\"Spot Weld 2\":0},\"2026-06\":{\"Turret Machine 1\":0,\"Turret Machine 2\":0,\"Turret Machine 3\":0,\"Arc Welding Machine\":0,\"Spot Weld 1\":0,\"Spot Weld 2\":0},\"2026-07\":{\"Turret Machine 1\":0,\"Turret Machine 2\":0,\"Turret Machine 3\":0,\"Arc Welding Machine\":0,\"Spot Weld 1\":0,\"Spot Weld 2\":0},\"2026-08\":{\"Turret Machine 1\":0,\"Turret Machine 2\":0,\"Turret Machine 3\":0,\"Arc Welding Machine\":0,\"Spot Weld 1\":0,\"Spot Weld 2\":0},\"2026-09\":{\"Turret Machine 1\":0,\"Turret Machine 2\":0,\"Turret Machine 3\":0,\"Arc Welding Machine\":0,\"Spot Weld 1\":0,\"Spot Weld 2\":0},\"2026-10\":{\"Turret Machine 1\":0,\"Turret Machine 2\":0,\"Turret Machine 3\":0,\"Arc Welding Machine\":0,\"Spot Weld 1\":0,\"Spot Weld 2\":0},\"2026-11\":{\"Turret Machine 1\":0,\"Turret Machine 2\":0,\"Turret Machine 3\":0,\"Arc Welding Machine\":0,\"Spot Weld 1\":0,\"Spot Weld 2\":0},\"2026-12\":{\"Turret Machine 1\":0,\"Turret Machine 2\":0,\"Turret Machine 3\":0,\"Arc Welding Machine\":0,\"Spot Weld 1\":0,\"Spot Weld 2\":0}}', '{\"2026-01\":{\"Turret Machine 1\":0,\"Turret Machine 2\":0,\"Turret Machine 3\":0,\"Arc Welding Machine\":0,\"Spot Weld 1\":0,\"Spot Weld 2\":0},\"2026-02\":{\"Turret Machine 1\":0,\"Turret Machine 2\":0,\"Turret Machine 3\":0,\"Arc Welding Machine\":0,\"Spot Weld 1\":0,\"Spot Weld 2\":0},\"2026-03\":{\"Turret Machine 1\":74.1029761904762,\"Turret Machine 2\":88.37569444444445,\"Turret Machine 3\":89.99265873015874,\"Arc Welding Machine\":24.256150793650793,\"Spot Weld 1\":11.61686507936508,\"Spot Weld 2\":0.6091269841269841},\"2026-04\":{\"Turret Machine 1\":77.53333333333335,\"Turret Machine 2\":46.42996031746031,\"Turret Machine 3\":89.9954365079365,\"Arc Welding Machine\":83.32509920634921,\"Spot Weld 1\":0,\"Spot Weld 2\":33.685218253968266},\"2026-05\":{\"Turret Machine 1\":75.48988095238094,\"Turret Machine 2\":0,\"Turret Machine 3\":89.99265873015874,\"Arc Welding Machine\":87.83402777777778,\"Spot Weld 1\":0,\"Spot Weld 2\":0},\"2026-06\":{\"Turret Machine 1\":0,\"Turret Machine 2\":0,\"Turret Machine 3\":20.121230158730157,\"Arc Welding Machine\":0,\"Spot Weld 1\":0,\"Spot Weld 2\":0},\"2026-07\":{\"Turret Machine 1\":15.172420634920636,\"Turret Machine 2\":0,\"Turret Machine 3\":0,\"Arc Welding Machine\":17.59593253968254,\"Spot Weld 1\":0,\"Spot Weld 2\":8.199503968253968},\"2026-08\":{\"Turret Machine 1\":77.34464285714286,\"Turret Machine 2\":0,\"Turret Machine 3\":0,\"Arc Welding Machine\":89.99384920634922,\"Spot Weld 1\":0,\"Spot Weld 2\":41.739781746031746},\"2026-09\":{\"Turret Machine 1\":28.306547619047624,\"Turret Machine 2\":0,\"Turret Machine 3\":0,\"Arc Welding Machine\":32.890277777777776,\"Spot Weld 1\":0,\"Spot Weld 2\":15.28501984126984},\"2026-10\":{\"Turret Machine 1\":0,\"Turret Machine 2\":0,\"Turret Machine 3\":0,\"Arc Welding Machine\":0,\"Spot Weld 1\":0,\"Spot Weld 2\":0},\"2026-11\":{\"Turret Machine 1\":0,\"Turret Machine 2\":0,\"Turret Machine 3\":0,\"Arc Welding Machine\":0,\"Spot Weld 1\":0,\"Spot Weld 2\":0},\"2026-12\":{\"Turret Machine 1\":0,\"Turret Machine 2\":0,\"Turret Machine 3\":0,\"Arc Welding Machine\":0,\"Spot Weld 1\":0,\"Spot Weld 2\":0}}', '2026-02-08 10:19:31');

-- --------------------------------------------------------

--
-- Table structure for table `orders`
--

CREATE TABLE `orders` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `order_id` varchar(32) NOT NULL,
  `part_code` varchar(32) NOT NULL,
  `quantity` double NOT NULL,
  `month` char(7) NOT NULL,
  `priority` enum('low','normal','high') NOT NULL DEFAULT 'normal',
  `created_by` varchar(64) NOT NULL DEFAULT 'unknown',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `orders`
--

INSERT INTO `orders` (`id`, `order_id`, `part_code`, `quantity`, `month`, `priority`, `created_by`, `created_at`, `updated_at`) VALUES
(1770468847684, 'O14', 'AC007', 50000, '2026-06', 'high', 'admin', '2026-02-07 04:54:07', '2026-02-08 10:19:09'),
(1770510421232, 'O15', 'AC050', 1200, '2026-03', 'normal', 'admin', '2026-02-07 16:27:01', '2026-02-08 10:19:30'),
(1770510491976, 'O16', 'AC006', 3200, '2026-03', 'normal', 'admin', '2026-02-07 16:28:11', '2026-02-08 10:19:30'),
(1770510505794, 'O17', 'AC007', 5000, '2026-03', 'normal', 'admin', '2026-02-07 16:28:25', '2026-02-08 10:19:30'),
(1770510525993, 'O18', 'AC011', 1000, '2026-02', 'normal', 'admin', '2026-02-07 16:28:45', '2026-02-08 10:21:09'),
(1770510586402, 'O19', 'AC013', 100, '2026-03', 'normal', 'admin', '2026-02-07 16:29:46', '2026-02-08 10:19:30'),
(1770510604427, 'O20', 'AC063', 620, '2026-04', 'normal', 'admin', '2026-02-07 16:30:04', '2026-02-08 10:19:30'),
(1770510654408, 'O21', 'AC004', 2000, '2026-04', 'normal', 'admin', '2026-02-07 16:30:54', '2026-02-08 10:19:30'),
(1770510676127, 'O22', 'AC005', 300, '2026-03', 'normal', 'admin', '2026-02-07 16:31:16', '2026-02-08 10:19:30'),
(1770510725613, 'O23', 'AC013', 5000, '2026-05', 'normal', 'admin', '2026-02-07 16:32:05', '2026-02-08 10:19:30'),
(1770513132650, 'O24', 'AC013', 12, '2026-03', 'low', 'admin', '2026-02-07 17:12:12', '2026-02-08 10:19:30'),
(1770513263947, 'O25', 'AC006', 1000, '2026-04', 'high', 'admin', '2026-02-07 17:14:23', '2026-02-08 10:19:30'),
(1770515687294, 'O26', 'AC002', 3006, '2026-04', 'normal', 'admin', '2026-02-07 17:54:47', '2026-02-08 10:19:30'),
(1770516523247, 'O27', 'AC002', 1000, '2026-04', 'normal', 'admin', '2026-02-07 18:08:43', '2026-02-08 10:19:30'),
(1770522375963, 'O28', 'AC002', 1000, '2026-07', 'normal', 'admin', '2026-02-07 19:46:15', '2026-02-08 10:19:30'),
(1770522454350, 'O29', 'AC002', 50, '2026-03', 'normal', 'admin', '2026-02-07 19:47:34', '2026-02-08 10:19:30'),
(1770522981395, 'O30', 'AC002', 9, '2026-03', 'normal', 'admin', '2026-02-07 19:56:21', '2026-02-08 10:19:30'),
(1770531800209, 'O31', 'AC002', 111, '2026-04', 'normal', 'admin', '2026-02-07 22:23:20', '2026-02-08 10:19:30'),
(1770540017984, 'O32', 'AC028', 6207, '2026-03', 'normal', 'admin', '2026-02-08 00:40:17', '2026-02-08 10:19:30'),
(1770540339953, 'O26-S9953', 'AC002', 5123, '2026-08', 'normal', 'admin', '2026-02-08 00:44:57', '2026-02-08 10:19:31'),
(1770542434357, 'O26-S9953-S4357', 'AC002', 1871, '2026-09', 'normal', 'admin', '2026-02-07 16:44:57', '2026-02-08 10:19:31'),
(1770720883557, 'O36-S4370-S3318-S6570-S4798-S055', 'AC028', 50343, '2027-02', 'normal', 'admin', '2026-02-10 10:54:11', '2026-02-10 11:54:11'),
(1770722015197, 'O37', 'AC028', 6207, '2026-05', 'normal', 'admin', '2026-02-10 11:13:35', '2026-02-10 12:13:35'),
(1770722060334, 'O37-S0334', 'AC028', 4904, '2026-06', 'normal', 'admin', '2026-02-10 11:13:35', '2026-02-10 12:13:35');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(10) UNSIGNED NOT NULL,
  `username` varchar(64) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `created_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `username`, `password_hash`, `created_at`) VALUES
(1, 'admin', '$2y$10$fr2odCAaLbgKOJaDtBOsKOaHhR78XUKOaxUPlc76bLTsgSzhnhML6', '2026-02-07 00:29:32'),
(2, 'sample', '$2y$10$vO9.LcO4xMMcFo139MG6LezPUQITevhBrOWm4yL2/IEmVEcZBAqx.', '2026-02-10 13:43:08');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `optimize_history`
--
ALTER TABLE `optimize_history`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_created_at` (`created_at`),
  ADD KEY `idx_user_id` (`user_id`);

--
-- Indexes for table `orders`
--
ALTER TABLE `orders`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_month` (`month`),
  ADD KEY `idx_part_code` (`part_code`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_username` (`username`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `optimize_history`
--
ALTER TABLE `optimize_history`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
