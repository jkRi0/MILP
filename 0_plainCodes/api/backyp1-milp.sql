-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Feb 08, 2026 at 09:43 AM
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
-- Table structure for table `orders`
--

CREATE TABLE `orders` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `order_id` varchar(32) NOT NULL,
  `part_code` varchar(32) NOT NULL,
  `quantity` double NOT NULL,
  `month` char(7) NOT NULL,
  `priority` enum('low','normal','high') NOT NULL DEFAULT 'normal',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `orders`
--

INSERT INTO `orders` (`id`, `order_id`, `part_code`, `quantity`, `month`, `priority`, `created_at`, `updated_at`) VALUES
(1770468847684, 'O14', 'AC007', 50000, '2026-06', 'high', '2026-02-07 12:54:07', '2026-02-07 07:54:09'),
(1770510421232, 'O15', 'AC050', 1200, '2026-02', 'normal', '2026-02-08 00:27:01', '2026-02-07 19:27:01'),
(1770510491976, 'O16', 'AC006', 3200, '2026-02', 'normal', '2026-02-08 00:28:11', '2026-02-07 19:28:12'),
(1770510505794, 'O17', 'AC007', 5000, '2026-02', 'normal', '2026-02-08 00:28:25', '2026-02-07 19:28:25'),
(1770510525993, 'O18', 'AC011', 12500, '2026-02', 'normal', '2026-02-08 00:28:45', '2026-02-07 19:28:46'),
(1770510586402, 'O19', 'AC013', 100, '2026-02', 'normal', '2026-02-08 00:29:46', '2026-02-07 19:29:48'),
(1770510604427, 'O20', 'AC063', 620, '2026-02', 'normal', '2026-02-08 00:30:04', '2026-02-07 19:30:04'),
(1770510654408, 'O21', 'AC004', 2000, '2026-02', 'normal', '2026-02-08 00:30:54', '2026-02-07 19:30:54'),
(1770510676127, 'O22', 'AC005', 300, '2026-02', 'normal', '2026-02-08 00:31:16', '2026-02-07 19:31:16'),
(1770510725613, 'O23', 'AC013', 5000, '2026-02', 'normal', '2026-02-08 00:32:05', '2026-02-07 19:32:05'),
(1770513132650, 'O24', 'AC013', 12, '2026-02', 'low', '2026-02-08 01:12:12', '2026-02-07 20:12:13'),
(1770513263947, 'O25', 'AC006', 1000, '2026-03', 'high', '2026-02-08 01:14:23', '2026-02-07 20:14:24'),
(1770515687294, 'O26', 'AC002', 10000, '2026-02', 'normal', '2026-02-08 01:54:47', '2026-02-08 02:54:47'),
(1770516523247, 'O27', 'AC002', 1000, '2026-03', 'normal', '2026-02-08 02:08:43', '2026-02-08 03:10:56'),
(1770522375963, 'O28', 'AC002', 1000, '2026-03', 'normal', '2026-02-08 03:46:15', '2026-02-08 04:46:16'),
(1770522454350, 'O29', 'AC002', 50, '2026-02', 'normal', '2026-02-08 03:47:34', '2026-02-08 04:47:34'),
(1770522981395, 'O30', 'AC002', 9, '2026-02', 'normal', '2026-02-08 03:56:21', '2026-02-08 04:56:21'),
(1770531800209, 'O31', 'AC002', 111, '2026-03', 'normal', '2026-02-08 06:23:20', '2026-02-08 07:23:20'),
(1770540017984, 'O32', 'AC028', 6207, '2026-02', 'normal', '2026-02-08 08:40:17', '2026-02-08 09:40:18'),
(1770540051242, 'O33', 'AC028', 2409, '2026-03', 'normal', '2026-02-08 08:40:51', '2026-02-08 09:41:21'),
(1770540096578, 'O32-S6578', 'AC028', 3792, '2026-03', 'normal', '2026-02-08 08:40:18', '2026-02-08 09:40:18'),
(1770540170588, 'O33-S0588', 'AC028', 7590, '2026-04', 'normal', '2026-02-08 08:41:21', '2026-02-08 09:41:21');

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
(1, 'admin', '$2y$10$fr2odCAaLbgKOJaDtBOsKOaHhR78XUKOaxUPlc76bLTsgSzhnhML6', '2026-02-07 00:29:32');

--
-- Indexes for dumped tables
--

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
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
