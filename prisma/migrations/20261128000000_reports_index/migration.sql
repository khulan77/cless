-- Тайлан: борлуулалтыг төлөгдсөн огноогоор (paidAt) шүүх. Зөвхөн index — өгөгдөл өөрчлөгдөхгүй.
CREATE INDEX "Sale_branchId_status_paidAt_idx" ON "Sale"("branchId", "status", "paidAt");
