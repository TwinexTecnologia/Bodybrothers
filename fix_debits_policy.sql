-- Permitir que o Personal gerencie seus recebimentos (debits)
-- Ele pode criar, ler, atualizar e deletar débitos onde ele é o recebedor
create policy "Personal manage own debits"
on public.debits
for all
using (receiver_id = auth.uid())
with check (receiver_id = auth.uid());

-- Permitir que o Aluno veja seus pagamentos (debits)
-- Ele só pode ler
create policy "Student read own debits"
on public.debits
for select
using (payer_id = auth.uid());
