/*
  Warnings:

  - You are about to drop the column `totalPrice` on the `Order` table. All the data in the column will be lost.
  - Added the required column `price` to the `OrderItem` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Order` DROP COLUMN `totalPrice`;

-- AlterTable
ALTER TABLE `OrderItem` ADD COLUMN `price` DOUBLE NOT NULL;
