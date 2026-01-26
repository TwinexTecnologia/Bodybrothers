
// Tabela TACO / USDA simplificada para alimentos naturais comuns
// Valores por 100g
export const commonFoods = [
    // Frutas (Sódio estimado: ~1mg/100g)
    { id: 'local_banana_prata', name: 'Banana Prata', calories: 98, protein: 1.3, carbs: 26.0, fat: 0.1, unit_weight: 80, sodium: 1 }, 
    { id: 'local_banana_nanica', name: 'Banana Nanica', calories: 92, protein: 1.4, carbs: 23.8, fat: 0.1, unit_weight: 100, sodium: 1 },
    { id: 'local_maca', name: 'Maçã Fuji', calories: 56, protein: 0.3, carbs: 15.2, fat: 0.2, unit_weight: 130, sodium: 1 },
    { id: 'local_abacaxi', name: 'Abacaxi', calories: 48, protein: 0.9, carbs: 12.3, fat: 0.1, unit_weight: 100, sodium: 1 },
    { id: 'local_mamao', name: 'Mamão Papaia', calories: 40, protein: 0.5, carbs: 10.4, fat: 0.1, unit_weight: 270, sodium: 3 },
    { id: 'local_morango', name: 'Morango', calories: 30, protein: 0.9, carbs: 6.8, fat: 0.3, unit_weight: 20, sodium: 1 },
    { id: 'local_uva', name: 'Uva', calories: 69, protein: 0.7, carbs: 18.1, fat: 0.2, unit_weight: 5, sodium: 2 },
    { id: 'local_abacate', name: 'Abacate', calories: 96, protein: 1.2, carbs: 6.0, fat: 8.4, unit_weight: 200, sodium: 7 },
    { id: 'local_melancia', name: 'Melancia', calories: 33, protein: 0.9, carbs: 8.1, fat: 0.0, unit_weight: 200, sodium: 1 },
    
    // Legumes e Verduras (Sódio baixo, exceto conservas)
    { id: 'local_cenoura_crua', name: 'Cenoura Crua', calories: 41, protein: 0.9, carbs: 9.6, fat: 0.2, unit_weight: 70, sodium: 69 }, // Cenoura tem um pouco mais naturalmente
    { id: 'local_cenoura_cozida', name: 'Cenoura Cozida', calories: 35, protein: 0.8, carbs: 8.2, fat: 0.2, unit_weight: 70, sodium: 50 },
    { id: 'local_alface', name: 'Alface', calories: 15, protein: 1.4, carbs: 2.9, fat: 0.2, unit_weight: 10, sodium: 9 },
    { id: 'local_tomate', name: 'Tomate', calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2, unit_weight: 100, sodium: 5 },
    { id: 'local_brocolis_cozido', name: 'Brócolis Cozido', calories: 35, protein: 2.4, carbs: 7.2, fat: 0.4, unit_weight: 50, sodium: 41 },
    { id: 'local_beterraba_cozida', name: 'Beterraba Cozida', calories: 44, protein: 1.7, carbs: 10.0, fat: 0.2, unit_weight: 100, sodium: 77 },
    { id: 'local_abobrinha_cozida', name: 'Abobrinha Cozida', calories: 17, protein: 1.2, carbs: 3.1, fat: 0.4, unit_weight: 100, sodium: 3 },
    { id: 'local_feijao_carioca', name: 'Feijão Carioca Cozido (s/ óleo)', calories: 76, protein: 4.8, carbs: 13.6, fat: 0.5, unit_weight: 100, sodium: 2 }, // Sem sal adicionado
    { id: 'local_feijao_preto', name: 'Feijão Preto Cozido (s/ óleo)', calories: 77, protein: 4.5, carbs: 14.0, fat: 0.5, unit_weight: 100, sodium: 2 },

    // Carboidratos
    { id: 'local_arroz_branco', name: 'Arroz Branco Cozido', calories: 128, protein: 2.5, carbs: 28.1, fat: 0.2, unit_weight: 150, sodium: 1 }, // Sem sal
    { id: 'local_arroz_integral', name: 'Arroz Integral Cozido', calories: 124, protein: 2.6, carbs: 25.8, fat: 1.0, unit_weight: 150, sodium: 1 },
    { id: 'local_farinha_arroz', name: 'Farinha de Arroz', calories: 363, protein: 7.2, carbs: 79.9, fat: 1.3, unit_weight: 30, sodium: 5 },
    { id: 'local_creme_arroz', name: 'Creme de Arroz (Pó)', calories: 370, protein: 7.0, carbs: 82.0, fat: 1.0, unit_weight: 30, sodium: 10 },
    { id: 'local_batata_doce', name: 'Batata Doce Cozida', calories: 77, protein: 0.6, carbs: 18.4, fat: 0.1, unit_weight: 150, sodium: 27 },
    { id: 'local_batata_inglesa', name: 'Batata Inglesa Cozida', calories: 52, protein: 1.2, carbs: 11.9, fat: 0.0, unit_weight: 150, sodium: 4 },
    { id: 'local_mandioca', name: 'Mandioca Cozida', calories: 125, protein: 0.6, carbs: 30.1, fat: 0.3, unit_weight: 100, sodium: 14 },
    { id: 'local_aveia', name: 'Aveia em Flocos', calories: 394, protein: 13.9, carbs: 66.6, fat: 8.5, unit_weight: 15, sodium: 2 },
    { id: 'local_farinha_aveia', name: 'Farinha de Aveia', calories: 390, protein: 14.0, carbs: 65.0, fat: 8.0, unit_weight: 15, sodium: 2 },
    { id: 'local_farelo_aveia', name: 'Farelo de Aveia', calories: 350, protein: 17.0, carbs: 45.0, fat: 9.0, unit_weight: 15, sodium: 2 },
    { id: 'local_tapioca', name: 'Tapioca (Goma)', calories: 242, protein: 0.0, carbs: 60.0, fat: 0.0, unit_weight: 20, sodium: 1 },
    { id: 'local_pao_frances', name: 'Pão Francês', calories: 300, protein: 8.0, carbs: 58.6, fat: 3.1, unit_weight: 50, sodium: 648 }, // Alto sódio
    { id: 'local_bisnaguinha', name: 'Bisnaguinha (Tipo Seven Boys)', calories: 300, protein: 8.0, carbs: 55.0, fat: 5.0, unit_weight: 20, sodium: 450 },
    { id: 'local_pao_forma', name: 'Pão de Forma Tradicional', calories: 250, protein: 8.0, carbs: 48.0, fat: 3.0, unit_weight: 25, sodium: 400 },
    { id: 'local_pao_forma_int', name: 'Pão de Forma Integral', calories: 240, protein: 10.0, carbs: 40.0, fat: 4.0, unit_weight: 25, sodium: 380 },
    { id: 'local_rap10', name: 'Rap10 (Tradicional)', calories: 300, protein: 7.0, carbs: 50.0, fat: 7.0, unit_weight: 40, sodium: 600 },
    { id: 'local_macarrao_cozido', name: 'Macarrão Cozido (Sem Molho)', calories: 157, protein: 5.8, carbs: 30.9, fat: 0.9, unit_weight: 150, sodium: 1 },
    { id: 'local_macarrao_cru', name: 'Macarrão Cru (Para pesar antes)', calories: 371, protein: 13.0, carbs: 75.0, fat: 1.5, unit_weight: 80, sodium: 6 },
    { id: 'local_biscoito_arroz', name: 'Biscoito de Arroz (Camil/Outros)', calories: 380, protein: 8.0, carbs: 80.0, fat: 2.5, unit_weight: 10, sodium: 150 },
    { id: 'local_cream_cracker', name: 'Biscoito Cream Cracker / Água e Sal', calories: 430, protein: 10.0, carbs: 68.0, fat: 14.0, unit_weight: 6, sodium: 700 },
    { id: 'local_biscoito_maizena', name: 'Biscoito Maizena / Maria', calories: 440, protein: 8.0, carbs: 74.0, fat: 12.0, unit_weight: 5, sodium: 300 },
    { id: 'local_cuscuz', name: 'Cuscuz de Milho Cozido', calories: 112, protein: 2.2, carbs: 25.0, fat: 0.7, unit_weight: 150, sodium: 5 },

    // Proteínas
    { id: 'local_frango_grelhado', name: 'Peito de Frango Grelhado', calories: 159, protein: 32.0, carbs: 0.0, fat: 2.5, unit_weight: 100, sodium: 50 }, // Sem sal adicionado (natural)
    { id: 'local_frango_cozido', name: 'Peito de Frango Cozido', calories: 163, protein: 31.5, carbs: 0.0, fat: 3.2, unit_weight: 100, sodium: 45 },
    { id: 'local_patinho', name: 'Carne Moída (Patinho) Refogada', calories: 219, protein: 35.9, carbs: 0.0, fat: 7.3, unit_weight: 100, sodium: 60 },
    { id: 'local_alcatra', name: 'Alcatra Grelhada', calories: 241, protein: 31.9, carbs: 0.0, fat: 11.6, unit_weight: 100, sodium: 55 },
    { id: 'local_tilapia', name: 'Tilápia Grelhada', calories: 120, protein: 26.0, carbs: 0.0, fat: 1.7, unit_weight: 100, sodium: 50 },
    { id: 'local_ovo_cozido', name: 'Ovo Cozido (unidade ~50g)', calories: 155, protein: 13.0, carbs: 1.1, fat: 11.0, unit_weight: 50, sodium: 124 },
    { id: 'local_ovo_frito', name: 'Ovo Frito', calories: 240, protein: 15.6, carbs: 1.2, fat: 18.6, unit_weight: 50, sodium: 150 }, // Considerando um pouco de sal ou óleo
    { id: 'local_clara', name: 'Clara de Ovo Cozida', calories: 54, protein: 13.0, carbs: 0.0, fat: 0.0, unit_weight: 35, sodium: 166 },
    
    // Laticínios e Outros
    { id: 'local_leite_integral', name: 'Leite Integral', calories: 60, protein: 3.0, carbs: 4.5, fat: 3.0, unit_weight: 200, sodium: 50 },
    { id: 'local_leite_desnatado', name: 'Leite Desnatado', calories: 35, protein: 3.0, carbs: 4.5, fat: 0.0, unit_weight: 200, sodium: 52 },
    { id: 'local_iogurte_natural', name: 'Iogurte Natural', calories: 61, protein: 4.1, carbs: 5.6, fat: 3.0, unit_weight: 170, sodium: 50 },
    { id: 'local_iogurte_desnatado', name: 'Iogurte Natural Desnatado', calories: 45, protein: 4.5, carbs: 6.0, fat: 0.1, unit_weight: 170, sodium: 55 },
    { id: 'local_iogurte_grego', name: 'Iogurte Grego Tradicional', calories: 110, protein: 4.0, carbs: 13.0, fat: 4.0, unit_weight: 100, sodium: 40 },
    { id: 'local_queijo_minas', name: 'Queijo Minas Frescal', calories: 264, protein: 17.4, carbs: 3.2, fat: 20.2, unit_weight: 30, sodium: 300 }, // Queijos variam muito
    { id: 'local_requeijao', name: 'Requeijão Cremoso Tradicional', calories: 280, protein: 9.0, carbs: 2.0, fat: 27.0, unit_weight: 30, sodium: 600 },
    { id: 'local_requeijao_light', name: 'Requeijão Light', calories: 180, protein: 10.0, carbs: 4.0, fat: 14.0, unit_weight: 30, sodium: 500 },
    { id: 'local_doce_leite', name: 'Doce de Leite (Tradicional)', calories: 315, protein: 6.0, carbs: 55.0, fat: 7.0, unit_weight: 20, sodium: 130 },
    { id: 'local_pasta_amendoim', name: 'Pasta de Amendoim (Integral)', calories: 590, protein: 25.0, carbs: 12.0, fat: 50.0, unit_weight: 15, sodium: 0 },
    { id: 'local_mel', name: 'Mel de Abelha', calories: 304, protein: 0.3, carbs: 82.0, fat: 0.0, unit_weight: 20, sodium: 4 },
    { id: 'local_geleia', name: 'Geleia de Frutas (Tradicional)', calories: 278, protein: 0.4, carbs: 68.0, fat: 0.1, unit_weight: 20, sodium: 30 },
    { id: 'local_geleia_diet', name: 'Geleia de Frutas (Diet/Zero)', calories: 50, protein: 0.5, carbs: 12.0, fat: 0.1, unit_weight: 20, sodium: 30 },
    { id: 'local_azeite', name: 'Azeite de Oliva', calories: 884, protein: 0.0, carbs: 0.0, fat: 100.0, unit_weight: 13, sodium: 0 },
    { id: 'local_whey', name: 'Whey Protein (Padrão)', calories: 400, protein: 80.0, carbs: 10.0, fat: 5.0, unit_weight: 30, sodium: 150 }, // Varia
    { id: 'local_creatina', name: 'Creatina Monohidratada', calories: 0, protein: 0.0, carbs: 0.0, fat: 0.0, unit_weight: 5, sodium: 0 },
]
