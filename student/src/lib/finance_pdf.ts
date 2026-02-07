import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

export async function generateFinancePdf(studentName: string, planTitle: string, payments: any[]) {
    // 1. Cria container temporário
    const container = document.createElement('div')
    container.style.position = 'absolute'
    container.style.left = '-9999px'
    container.style.top = '0'
    container.style.width = '210mm'
    container.style.minHeight = '297mm'
    container.style.background = '#fff'
    container.style.color = '#000'
    container.style.padding = '15mm'
    container.style.fontFamily = 'Arial, sans-serif'
    
    // 2. Monta HTML
    let html = `
        <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="margin: 0; color: #1e3a8a; font-size: 24px;">Extrato Financeiro</h1>
            <p style="color: #64748b; margin-top: 5px;">BodyBrothers Consultoria</p>
        </div>

        <div style="margin-bottom: 30px; background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                <strong>Aluno:</strong> <span>${studentName}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                <strong>Plano Atual:</strong> <span>${planTitle}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
                <strong>Data de Emissão:</strong> <span>${new Date().toLocaleDateString('pt-BR')}</span>
            </div>
        </div>

        <h3 style="border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; margin-bottom: 20px; color: #334155;">Histórico de Lançamentos</h3>
    `

    if (payments.length === 0) {
        html += `<div style="text-align: center; color: #94a3b8; padding: 20px;">Nenhum registro encontrado.</div>`
    } else {
        html += `
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <thead>
                    <tr style="background: #f1f5f9; text-align: left;">
                        <th style="padding: 10px; border-bottom: 2px solid #e2e8f0;">Descrição</th>
                        <th style="padding: 10px; border-bottom: 2px solid #e2e8f0;">Vencimento</th>
                        <th style="padding: 10px; border-bottom: 2px solid #e2e8f0;">Pagamento</th>
                        <th style="padding: 10px; border-bottom: 2px solid #e2e8f0;">Status</th>
                        <th style="padding: 10px; border-bottom: 2px solid #e2e8f0; text-align: right;">Valor</th>
                    </tr>
                </thead>
                <tbody>
        `

        payments.forEach((p, i) => {
            const bg = i % 2 === 0 ? '#fff' : '#f9fafb'
            const statusColor = p.status === 'paid' ? '#16a34a' : p.status === 'overdue' ? '#dc2626' : '#d97706'
            const statusLabel = p.status === 'paid' ? 'PAGO' : p.status === 'overdue' ? 'ATRASADO' : 'PENDENTE'
            
            html += `
                <tr style="background: ${bg};">
                    <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${p.description || 'Mensalidade'}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${new Date(p.dueDate).toLocaleDateString('pt-BR')}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${p.paidAt ? new Date(p.paidAt).toLocaleDateString('pt-BR') : '-'}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; color: ${statusColor}; font-weight: bold;">${statusLabel}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">R$ ${Number(p.amount).toFixed(2)}</td>
                </tr>
            `
        })

        html += `</tbody></table>`
    }

    html += `
        <div style="margin-top: 50px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 20px;">
            Este documento é apenas para conferência e não possui valor fiscal.
        </div>
    `

    container.innerHTML = html
    document.body.appendChild(container)

    try {
        // Aguarda renderização
        await new Promise(r => setTimeout(r, 500))

        const canvas = await html2canvas(container, { 
            scale: 2,
            useCORS: true,
            allowTaint: true
        })
        const imgData = canvas.toDataURL('image/png')
        
        const pdf = new jsPDF('p', 'mm', 'a4')
        const pdfWidth = pdf.internal.pageSize.getWidth()
        const pdfHeight = pdf.internal.pageSize.getHeight()
        const imgWidth = pdfWidth
        const imgHeight = (canvas.height * imgWidth) / canvas.width
        
        let heightLeft = imgHeight
        let position = 0

        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pdfHeight

        while (heightLeft > 0) {
          position = heightLeft - imgHeight
          pdf.addPage()
          pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
          heightLeft -= pdfHeight
        }
        
        pdf.save(`Extrato_${studentName.replace(/\s+/g, '_')}.pdf`)
    } catch (err) {
        console.error('Erro ao gerar PDF:', err)
        alert('Erro ao gerar PDF do extrato.')
    } finally {
        document.body.removeChild(container)
    }
}
