create or replace function public.validate_simple_national_payload(
  _kind text, _competence_key text, _input jsonb, _sources jsonb
) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare
  _blocking jsonb := '[]'::jsonb;
  _warnings jsonb := '[]'::jsonb;
  _revenue numeric;
begin
  if _kind not in ('pgdasd','defis','regime_apuracao') then
    _blocking := _blocking || jsonb_build_array(jsonb_build_object('code','unsupported_obligation','message','Obrigação não suportada.'));
  end if;
  if _competence_key !~ '^\d{4}(\d{2})?$' then
    _blocking := _blocking || jsonb_build_array(jsonb_build_object('code','invalid_competence','message','Competência inválida.'));
  end if;
  if jsonb_typeof(coalesce(_sources, 'null'::jsonb)) <> 'array' or jsonb_array_length(_sources) = 0 then
    _blocking := _blocking || jsonb_build_array(jsonb_build_object('code','missing_sources','message','Informe ao menos uma fonte dos dados.'));
  end if;
  if _kind = 'pgdasd' then
    if length(regexp_replace(coalesce(_input->>'cnpj',''), '\D', '', 'g')) <> 14 then
      _blocking := _blocking || jsonb_build_array(jsonb_build_object('code','invalid_cnpj','message','CNPJ do contribuinte é obrigatório.'));
    end if;
    if coalesce(_input->>'revenue_regime','') not in ('caixa','competencia') then
      _blocking := _blocking || jsonb_build_array(jsonb_build_object('code','missing_revenue_regime','message','Defina o regime de caixa ou competência.'));
    end if;
    begin _revenue := (_input->>'revenue_total')::numeric; exception when others then _revenue := null; end;
    if _revenue is null or _revenue < 0 then
      _blocking := _blocking || jsonb_build_array(jsonb_build_object('code','invalid_revenue','message','Informe a receita total da competência.'));
    end if;
    if jsonb_typeof(coalesce(_input->'revenue_by_activity','null'::jsonb)) <> 'array' or jsonb_array_length(_input->'revenue_by_activity') = 0 then
      _blocking := _blocking || jsonb_build_array(jsonb_build_object('code','missing_activity_breakdown','message','Classifique a receita por atividade.'));
    end if;
    if not (_input ? 'payroll_r12') then
      _warnings := _warnings || jsonb_build_array(jsonb_build_object('code','payroll_not_informed','message','Folha R12 não informada; confirme se o Fator R não se aplica.'));
    end if;
  elsif _kind = 'defis' then
    if length(_competence_key) <> 4 then
      _blocking := _blocking || jsonb_build_array(jsonb_build_object('code','defis_requires_year','message','A DEFIS exige ano-calendário.'));
    end if;
    if not (_input ? 'annual_revenue') or not (_input ? 'partners_reviewed') then
      _blocking := _blocking || jsonb_build_array(jsonb_build_object('code','defis_incomplete','message','Receita anual e revisão de sócios são obrigatórias.'));
    end if;
  elsif _kind = 'regime_apuracao' then
    if length(_competence_key) <> 4 or coalesce(_input->>'revenue_regime','') not in ('caixa','competencia') then
      _blocking := _blocking || jsonb_build_array(jsonb_build_object('code','regime_incomplete','message','Informe ano e regime de apuração.'));
    end if;
  end if;
  return jsonb_build_object('blocking', _blocking, 'warnings', _warnings, 'valid', jsonb_array_length(_blocking) = 0);
end $$;
