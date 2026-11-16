// S.P.A.R.K. — Elle girilen harcamanın kaydı (UI denetimi CQ-03)
//
// Harcama satırı ile depozito kuponu geri kazanım eşitlemesi tek atomik
// işlemdir. Bu işlem eskiden `app/add-expense.tsx` içinde iki kez (kaydet ve
// ayrıntılı düzenleme taslağı) ekrandan `getDatabase()` ile yönetiliyordu.
import { getDatabase } from '../db/database';
import { ExpenseDao } from '../db/expenseDao';
import { ContainerDepositDao } from '../db/containerDepositDao';

export interface ManualExpenseInput {
  total_amount: number;
  currency: string;
  note: string | null;
  date: string;
  vendor_id: number | null;
  category_id: number | null;
  container_deposit_paid: number;
  container_voucher_used: number;
}

/**
 * `expenseId` verilirse günceller, verilmezse oluşturur; ardından aynı işlem
 * içinde depozito geri kazanımını eşitler. Kaydedilen harcama kimliğini döner.
 */
export async function saveManualExpense(
  input: ManualExpenseInput,
  options: { expenseId?: number; voucherId?: number } = {},
): Promise<number> {
  const db = await getDatabase();
  let savedId = 0;
  await db.withTransactionAsync(async () => {
    if (options.expenseId != null) {
      savedId = options.expenseId;
      await ExpenseDao.update(savedId, input);
    } else {
      savedId = await ExpenseDao.create({ ...input, receipt_uri: null });
    }
    await ContainerDepositDao.syncPurchaseRecovery(savedId, options.voucherId);
  });
  return savedId;
}
