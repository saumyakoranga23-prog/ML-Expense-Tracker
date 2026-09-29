import { Activity, Landmark, ReceiptText, TrendingDown, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Card } from '@/components/ui/card';
import type { Kpis as KpisModel } from '@/types/api';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDate, formatNumber, formatPercent, formatSignedCurrency } from '@/utils/format';

interface Kpi {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  tone?: 'default' | 'positive' | 'negative';
}

export function KpiGrid({ kpis, className }: { kpis: KpisModel; className?: string }) {
  const cards: Kpi[] = [
    {
      label: 'Total Spending',
      value: formatCurrency(kpis.total_spending),
      hint: `${formatNumber(kpis.expense_count)} expense transactions`,
      icon: Wallet,
      tone: 'default',
    },
    {
      label: 'Total Income',
      value: formatCurrency(kpis.total_income),
      hint: `${formatNumber(kpis.income_count)} income transactions`,
      icon: Landmark,
      tone: 'positive',
    },
    {
      label: 'Net Cash Flow',
      value: formatSignedCurrency(kpis.net_cash_flow),
      hint: kpis.total_income > 0 ? `Savings rate ${formatPercent(kpis.savings_rate)} of income` : 'No income recorded',
      icon: Activity,
      tone: kpis.net_cash_flow >= 0 ? 'positive' : 'negative',
    },
    {
      label: 'Average Monthly Spending',
      value: formatCurrency(kpis.average_monthly_spending),
      hint: `Across ${kpis.months_covered} months of data`,
      icon: TrendingDown,
      tone: 'default',
    },
    {
      label: 'Largest Expense',
      value: formatCurrency(kpis.largest_expense),
      hint: kpis.largest_expense_description
        ? `${kpis.largest_expense_description} · ${formatDate(kpis.largest_expense_date)}`
        : 'No expenses recorded',
      icon: TrendingDown,
      tone: 'negative',
    },
    {
      label: 'Transactions',
      value: formatNumber(kpis.transaction_count),
      hint: `Average ${formatCurrency(kpis.average_transaction)} per transaction`,
      icon: ReceiptText,
      tone: 'default',
    },
  ];

  return (
    <section className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6', className)} aria-label="Key metrics">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.label} className="min-w-0 p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="label-caps">{card.label}</p>
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </div>
            <p
              className={cn(
                'metric-value mt-3 text-lg',
                card.tone === 'positive' && 'text-positive',
                card.tone === 'negative' && 'text-negative',
              )}
            >
              {card.value}
            </p>
            <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground" title={card.hint}>
              {card.hint}
            </p>
          </Card>
        );
      })}
    </section>
  );
}
