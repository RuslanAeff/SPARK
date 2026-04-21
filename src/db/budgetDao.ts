// S.P.A.R.K. — Budget Data Access Object
import { getDatabase } from './database';
import { Budget } from './schema';

export const BudgetDao = {
  // Get active budget for a specific month (format: 'YYYY-MM')
  async getForMonth(month: string): Promise<Budget | null> {
    const db = await getDatabase();
    return db.getFirstAsync<Budget>(
      'SELECT * FROM budgets WHERE start_date = ? AND active = 1 ORDER BY id DESC LIMIT 1',
      [month]
    );
  },

  // Fallback to latest active budget if current month has none
  async getLatestActive(): Promise<Budget | null> {
    const db = await getDatabase();
    return db.getFirstAsync<Budget>(
      'SELECT * FROM budgets WHERE active = 1 ORDER BY start_date DESC LIMIT 1'
    );
  },

  // Set budget for a specific month
  async setMonthlyBudget(amount: number, month: string, currency: string = 'PLN'): Promise<number> {
    const db = await getDatabase();
    
    // Deactivate previous budgets for this specific month just in case
    await db.runAsync('UPDATE budgets SET active = 0 WHERE start_date = ?', [month]);
    
    // Create new active budget for this month
    const result = await db.runAsync(
      'INSERT INTO budgets (monthly_amount, currency, start_date, active) VALUES (?, ?, ?, 1)',
      [amount, currency, month]
    );
    return result.lastInsertRowId;
  },

  // Get all months that have a budget set (for history view)
  async getAllBudgets(): Promise<Budget[]> {
    const db = await getDatabase();
    return db.getAllAsync<Budget>(
      'SELECT * FROM budgets WHERE active = 1 ORDER BY start_date DESC'
    );
  },
};
