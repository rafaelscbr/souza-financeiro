import { MonthlyClosePanel } from '@/features/personal/MonthlyClosePanel'
import { AnnualReportPanel } from '@/features/personal/AnnualReportPanel'

/** Fechamento do mês, conciliação e o resumo do ano que apoia o IR. */
export function RelatoriosPessoaisPage() {
  return (
    <div className="space-y-5">
      <MonthlyClosePanel />
      <AnnualReportPanel />
    </div>
  )
}
