-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Feb 07, 2026 at 02:17 AM
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
-- Database: `milp_scheduler`
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
(1770418473795, 'O1', 'AC002', 2000, '2026-02', 'normal', '2026-02-06 22:54:33', '2026-02-06 23:54:33'),
(1770418942984, 'O2', 'AC008', 1000, '2026-02', 'normal', '2026-02-06 23:02:22', '2026-02-07 00:02:22'),
(1770418953565, 'O3', 'AC033', 555, '2026-02', 'normal', '2026-02-06 23:02:33', '2026-02-07 00:02:33'),
(1770418962801, 'O4', 'AC014', 555, '2026-02', 'normal', '2026-02-06 23:02:42', '2026-02-07 00:02:42'),
(1770418972778, 'O5', 'AC055', 4000, '2026-02', 'normal', '2026-02-06 23:02:52', '2026-02-07 00:02:52'),
(1770419002735, 'O6', 'AC008', 1000, '2026-02', 'normal', '2026-02-06 23:03:22', '2026-02-07 01:31:09'),
(1770419050130, 'O7', 'AC008', 1000, '2026-02', 'normal', '2026-02-06 23:04:10', '2026-02-07 00:04:10'),
(1770420935178, 'O8', 'AC021', 50, '2026-02', 'normal', '2026-02-06 23:35:35', '2026-02-07 01:31:24'),
(1770422730513, 'O9', 'AC038', 100, '2026-02', 'normal', '2026-02-07 00:05:30', '2026-02-07 01:05:30'),
(1770423089060, 'O10', 'AC038', 5000, '2026-03', 'normal', '2026-02-07 00:11:29', '2026-02-07 01:20:09'),
(1770423184411, 'O11', 'AC028', 200, '2026-02', 'normal', '2026-02-07 00:13:04', '2026-02-07 01:29:57');

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
