
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
    { id: 'local_manga', name: 'Manga', calories: 60, protein: 0.8, carbs: 15.0, fat: 0.4, unit_weight: 200, sodium: 1 },
    { id: 'local_laranja', name: 'Laranja', calories: 47, protein: 0.9, carbs: 11.8, fat: 0.1, unit_weight: 130, sodium: 0 },
    { id: 'local_limao', name: 'Limão', calories: 29, protein: 1.1, carbs: 9.3, fat: 0.3, unit_weight: 100, sodium: 2 },
    { id: 'local_tangerina', name: 'Tangerina / Mexerica', aliases: ['bergamota', 'ponkan'], calories: 53, protein: 0.8, carbs: 13.3, fat: 0.3, unit_weight: 100, sodium: 2 },
    { id: 'local_pessego', name: 'Pêssego', calories: 39, protein: 0.9, carbs: 9.5, fat: 0.3, unit_weight: 150, sodium: 0 },
    { id: 'local_pera', name: 'Pêra', calories: 57, protein: 0.4, carbs: 15.2, fat: 0.1, unit_weight: 150, sodium: 1 },
    { id: 'local_goiaba', name: 'Goiaba', calories: 68, protein: 2.6, carbs: 14.3, fat: 1.0, unit_weight: 150, sodium: 2 },
    { id: 'local_kiwi', name: 'Kiwi', calories: 61, protein: 1.1, carbs: 14.7, fat: 0.5, unit_weight: 75, sodium: 3 },
    { id: 'local_maracuja', name: 'Maracujá', calories: 97, protein: 2.2, carbs: 23.4, fat: 0.7, unit_weight: 50, sodium: 28 },
    { id: 'local_ameixa', name: 'Ameixa Fresca', calories: 46, protein: 0.7, carbs: 11.4, fat: 0.3, unit_weight: 100, sodium: 0 },
    { id: 'local_ameixa_seca', name: 'Ameixa Seca', calories: 240, protein: 2.2, carbs: 63.9, fat: 0.4, unit_weight: 10, sodium: 2 },
    
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
    { id: 'local_grao_bico', name: 'Grão-de-bico Cozido', calories: 164, protein: 8.9, carbs: 27.4, fat: 2.6, unit_weight: 100, sodium: 7 },
    { id: 'local_lentilha', name: 'Lentilha Cozida', calories: 116, protein: 9.0, carbs: 20.1, fat: 0.4, unit_weight: 100, sodium: 2 },
    { id: 'local_ervilha', name: 'Ervilha Cozida', calories: 81, protein: 5.4, carbs: 14.4, fat: 0.4, unit_weight: 100, sodium: 5 },
    { id: 'local_soja', name: 'Soja Cozida', calories: 173, protein: 16.6, carbs: 9.9, fat: 9.0, unit_weight: 100, sodium: 1 },

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
    { id: 'local_chia', name: 'Semente de Chia', calories: 486, protein: 17.0, carbs: 42.0, fat: 31.0, unit_weight: 15, sodium: 16 },
    { id: 'local_linhaca', name: 'Semente de Linhaça', calories: 534, protein: 18.3, carbs: 28.9, fat: 42.2, unit_weight: 15, sodium: 30 },
    { id: 'local_gergelim', name: 'Semente de Gergelim', calories: 573, protein: 17.7, carbs: 23.4, fat: 49.7, unit_weight: 15, sodium: 11 },
    { id: 'local_semente_abobora', name: 'Semente de Abóbora', calories: 559, protein: 30.2, carbs: 10.7, fat: 49.0, unit_weight: 15, sodium: 7 },
    { id: 'local_girassol', name: 'Semente de Girassol', calories: 584, protein: 20.8, carbs: 20.0, fat: 51.5, unit_weight: 15, sodium: 9 },
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
    { id: 'local_iogurte_natural', name: 'Iogurte Natural', aliases: ['iorgute', 'yogurt'], calories: 61, protein: 4.1, carbs: 5.6, fat: 3.0, unit_weight: 170, sodium: 50 },
    { id: 'local_iogurte_desnatado', name: 'Iogurte Natural Desnatado', aliases: ['iorgute', 'yogurt'], calories: 45, protein: 4.5, carbs: 6.0, fat: 0.1, unit_weight: 170, sodium: 55 },
    { id: 'local_iogurte_grego', name: 'Iogurte Grego Tradicional', aliases: ['iorgute', 'yogurt'], calories: 110, protein: 4.0, carbs: 13.0, fat: 4.0, unit_weight: 100, sodium: 40 },
    { id: 'local_queijo_minas', name: 'Queijo Minas Frescal', aliases: ['queijo', 'mussarela', 'mozarela'], calories: 264, protein: 17.4, carbs: 3.2, fat: 20.2, unit_weight: 30, sodium: 300 }, // Queijos variam muito
    { id: 'local_requeijao', name: 'Requeijão Cremoso Tradicional', calories: 280, protein: 9.0, carbs: 2.0, fat: 27.0, unit_weight: 30, sodium: 600 },
    { id: 'local_requeijao_light', name: 'Requeijão Light', calories: 180, protein: 10.0, carbs: 4.0, fat: 14.0, unit_weight: 30, sodium: 500 },
    { id: 'local_doce_leite', name: 'Doce de Leite (Tradicional)', calories: 315, protein: 6.0, carbs: 55.0, fat: 7.0, unit_weight: 20, sodium: 130 },
    { id: 'local_pasta_amendoim', name: 'Pasta de Amendoim (Integral)', calories: 590, protein: 25.0, carbs: 12.0, fat: 50.0, unit_weight: 15, sodium: 0 },
    { id: 'local_mel', name: 'Mel de Abelha', calories: 304, protein: 0.3, carbs: 82.0, fat: 0.0, unit_weight: 20, sodium: 4 },
    { id: 'local_geleia', name: 'Geleia de Frutas (Tradicional)', calories: 278, protein: 0.4, carbs: 68.0, fat: 0.1, unit_weight: 20, sodium: 30 },
    { id: 'local_geleia_diet', name: 'Geleia de Frutas (Diet/Zero)', calories: 50, protein: 0.5, carbs: 12.0, fat: 0.1, unit_weight: 20, sodium: 30 },
    { id: 'local_azeite', name: 'Azeite de Oliva', calories: 884, protein: 0.0, carbs: 0.0, fat: 100.0, unit_weight: 13, sodium: 0 },
    { id: 'local_canela', name: 'Canela em Pó', calories: 247, protein: 4.0, carbs: 81.0, fat: 1.2, unit_weight: 5, sodium: 10 },
    { id: 'local_cacau_po', name: 'Cacau em Pó (100%)', calories: 228, protein: 19.6, carbs: 57.9, fat: 13.7, unit_weight: 20, sodium: 21 },
    { id: 'local_cafe_po', name: 'Café em Pó', calories: 426, protein: 14.6, carbs: 68.4, fat: 11.6, unit_weight: 10, sodium: 43 },
    { id: 'local_castanha_para', name: 'Castanha do Pará', calories: 659, protein: 14.0, carbs: 12.0, fat: 66.0, unit_weight: 5, sodium: 3 },
    { id: 'local_castanha_caju', name: 'Castanha de Caju', calories: 553, protein: 18.2, carbs: 30.2, fat: 43.8, unit_weight: 15, sodium: 12 },
    { id: 'local_nozes', name: 'Nozes', calories: 654, protein: 15.0, carbs: 14.0, fat: 65.0, unit_weight: 5, sodium: 2 },
    { id: 'local_amendoas', name: 'Amêndoas', calories: 579, protein: 21.0, carbs: 22.0, fat: 50.0, unit_weight: 15, sodium: 1 },
    { id: 'local_amendoim', name: 'Amendoim Torrado', calories: 567, protein: 25.8, carbs: 16.1, fat: 49.2, unit_weight: 15, sodium: 18 },
    { id: 'local_whey', name: 'Whey Protein (Padrão)', calories: 400, protein: 80.0, carbs: 10.0, fat: 5.0, unit_weight: 30, sodium: 150 }, // Varia
    { id: 'local_creatina', name: 'Creatina Monohidratada', calories: 0, protein: 0.0, carbs: 0.0, fat: 0.0, unit_weight: 5, sodium: 0 },
]
