import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import type { DietRecord } from '../store/diets'

export async function generateDietPdf(d: DietRecord, logoUrl: string) {
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
    let activeMeals = d.meals
    let activeVariantName = 'Padrão'
    
    if (d.variants && d.variants.length > 0) {
        activeMeals = d.variants[0].meals
        activeVariantName = d.variants[0].name
    }

    let html = ``
    
    if (logoUrl) {
        html += `
            <div style="text-align: center; margin-bottom: 30px;">
                <img src="${logoUrl}" style="max-height: 220px; object-fit: contain;" crossOrigin="anonymous" />
            </div>
        `
    }

    html += `
        <h1 style="text-align: center; margin-bottom: 5px; font-size: 24px; background: #1e3a8a; color: #fff; padding: 12px; border-radius: 8px; text-transform: uppercase; letter-spacing: 1px;">${d.name}</h1>
        <div style="text-align: center; margin-bottom: 25px; color: #4b5563; font-size: 18px; marginTop: 10px; font-weight: 600;">${activeVariantName}</div>
    `

    if (d.goal || d.startDate || d.endDate) {
        html += `<div style="margin-bottom: 30px; display: flex; gap: 20px; justify-content: center; font-size: 14px; color: #444; border-bottom: 1px solid #e5e7eb; padding-bottom: 20px;">`
        if (d.goal) html += `<div><strong>Objetivo:</strong> ${d.goal}</div>`
        if (d.startDate) html += `<div><strong>Início:</strong> ${new Date(d.startDate).toLocaleDateString()}</div>`
        if (d.endDate) html += `<div><strong>Fim:</strong> ${new Date(d.endDate).toLocaleDateString()}</div>`
        html += `</div>`
    }

    if (d.notes) {
        html += `
            <div style="margin-bottom: 30px; font-style: italic; background: #f8fafc; padding: 15px; border-radius: 8px; border-left: 4px solid #1e3a8a;">
                ${d.notes}
            </div>
        `
    }

    html += `<div style="display: flex; flex-direction: column; gap: 25px;">`
    activeMeals.forEach((m, i) => {
        html += `
            <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; break-inside: avoid; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                <div style="background: #1e3a8a; color: #fff; padding: 10px 15px; font-weight: bold; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 16px; text-transform: uppercase;">${m.title || `Refeição ${i+1}`}</span>
                    <span style="font-size: 15px; font-weight: 500;">${m.time}</span>
                </div>
                <div style="padding: 15px;">
        `
        m.foods.forEach((f, fi) => {
            html += `
                <div style="margin-bottom: 10px; font-size: 15px; border-bottom: ${fi < m.foods.length - 1 ? '1px solid #f1f5f9' : 'none'}; padding-bottom: ${fi < m.foods.length - 1 ? '10px' : '0'};">
                    <div style="display: flex; justify-content: space-between;">
                        <strong style="font-weight: 700; color: #1e293b;">${f.name}</strong> 
                        <span style="font-weight: 600;">${f.quantity ? `${f.quantity} ${f.unit}` : ''}</span>
                    </div>
            `
            if (f.substitutes && f.substitutes.length > 0) {
                f.substitutes.forEach(s => {
                    html += `
                        <div style="margin-left: 15px; margin-top: 4px; color: #64748b; font-size: 0.9em; display: flex; align-items: center;">
                            <span style="margin-right: 5px;">↳</span> ou ${s.name} - ${s.quantity} ${s.unit}
                        </div>
                    `
                })
            }
            html += `</div>`
        })
        
        html += `</div>`
        
        if (m.notes) {
            html += `
                <div style="padding: 10px 15px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 13px; color: #475569;">
                    <strong>Obs:</strong> ${m.notes}
                </div>
            `
        }
        html += `</div>`
    })
    html += `</div>`

    if (d.supplements && d.supplements.length > 0) {
        html += `
            <div style="margin-top: 30px; break-inside: avoid;">
                <h3 style="border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; margin-bottom: 15px; font-size: 18px;">Suplementação</h3>
                <div style="display: grid; gap: 10px;">
        `
        d.supplements.forEach(s => {
            html += `
                <div style="font-size: 14px; padding: 8px; background: #f9fafb; border-radius: 6px;">
                    • <strong>${s.name}</strong> - ${s.quantity} ${s.unit}
                    ${s.notes ? `<span style="color: #666;"> (${s.notes})</span>` : ''}
                </div>
            `
        })
        html += `</div></div>`
    }

    html += `
        <div style="margin-top: 40px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 20px;">
            Gerado por BodyBrothers App • ${new Date().toLocaleDateString()}
        </div>
    `

    container.innerHTML = html
    document.body.appendChild(container)

    try {
        // Aguarda um pouco para garantir renderização de imagens
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
        
        pdf.save(`Dieta_${d.name.replace(/\s+/g, '_')}.pdf`)
    } catch (err) {
        console.error('Erro ao gerar PDF:', err)
        alert('Erro ao gerar PDF')
    } finally {
        document.body.removeChild(container)
    }
}
