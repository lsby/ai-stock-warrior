-- CreateTable
CREATE TABLE "trade_account" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'DEFAULT_ACCOUNT',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cash" REAL NOT NULL,
    "frozen_cash" REAL NOT NULL DEFAULT 0,
    "initial_cash" REAL NOT NULL DEFAULT 100000
);

-- CreateTable
CREATE TABLE "trade_position" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "symbol" TEXT NOT NULL,
    "sec_name" TEXT NOT NULL,
    "volume" INTEGER NOT NULL,
    "available_volume" INTEGER NOT NULL,
    "vwap" REAL NOT NULL
);

-- CreateTable
CREATE TABLE "trade_order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "symbol" TEXT NOT NULL,
    "sec_name" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "order_type" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "volume" INTEGER NOT NULL,
    "filled_volume" INTEGER NOT NULL DEFAULT 0,
    "filled_vwap" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "reject_reason" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "trade_position_symbol_key" ON "trade_position"("symbol");
