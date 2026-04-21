import { supabase } from "@/integrations/supabase/client";

export interface CompletionCascadeResult {
  requestUpdated: number;
  submissionsUpdated: number;
  errors: string[];
}

export const completeLinkedRequestAndFormSubmissions = async (
  requestId: string | null | undefined,
): Promise<CompletionCascadeResult> => {
  if (!requestId) {
    return {
      requestUpdated: 0,
      submissionsUpdated: 0,
      errors: [],
    };
  }

  const result: CompletionCascadeResult = {
    requestUpdated: 0,
    submissionsUpdated: 0,
    errors: [],
  };

  const { data: requestRows, error: requestError } = await supabase
    .from("client_requests")
    .update({ status: "completed" })
    .eq("id", requestId)
    .in("status", ["pending", "in_progress"])
    .select("id");

  if (requestError) {
    result.errors.push(`solicitacao: ${requestError.message}`);
  } else {
    result.requestUpdated = requestRows?.length || 0;
  }

  const { data: submissionRows, error: submissionError } = await supabase
    .from("form_submissions")
    .update({ status: "completed" })
    .eq("request_id", requestId)
    .in("status", ["pending", "in_review"])
    .select("id");

  if (submissionError) {
    result.errors.push(`formulario: ${submissionError.message}`);
  } else {
    result.submissionsUpdated = submissionRows?.length || 0;
  }

  return result;
};
