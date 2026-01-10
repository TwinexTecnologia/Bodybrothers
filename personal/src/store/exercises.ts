import { supabase } from '../lib/supabase'

export interface Exercise {
    id: string
    personal_id: string
    name: string
    muscle_group?: string
    video_url?: string
    created_at: string
}

export interface CreateExerciseDTO {
    name: string
    muscle_group?: string
    video_url?: string
}

export async function listExercises(personalId: string) {
    const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .eq('personal_id', personalId)
        .order('name', { ascending: true })
    
    if (error) throw error
    return data as Exercise[]
}

export async function createExercise(personalId: string, exercise: CreateExerciseDTO) {
    const { data, error } = await supabase
        .from('exercises')
        .insert({
            personal_id: personalId,
            ...exercise
        })
        .select()
        .single()

    if (error) throw error
    return data as Exercise
}

export async function updateExercise(id: string, exercise: Partial<CreateExerciseDTO>) {
    const { data, error } = await supabase
        .from('exercises')
        .update(exercise)
        .eq('id', id)
        .select()
        .single()

    if (error) throw error
    return data as Exercise
}

export async function deleteExercise(id: string) {
    const { error } = await supabase
        .from('exercises')
        .delete()
        .eq('id', id)

    if (error) throw error
}
