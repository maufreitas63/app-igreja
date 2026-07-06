-- Parte 5/5 — recarrega cache do PostgREST (rode só quando as partes 1–4 ok)
-- Se der OOM de novo: aguarde 5 min ou reinicie o projeto no Dashboard e tente só esta linha.

notify pgrst, 'reload schema';
