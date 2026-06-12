import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteReportModel,
  listSavedReports,
  saveReportModel,
  validateSavedReportModel,
} from "@/lib/reports/savedReportRepository";
import type { ReportDatasetId, SavedReportModel } from "@/lib/reports/types";
import { reportQueryKeys } from "./reportQueryKeys";

export function useSavedReports(input: { organizationId: string | null; userId: string | null }) {
  const queryClient = useQueryClient();
  const queryKey = reportQueryKeys.savedReports(input.organizationId, input.userId);

  const query = useQuery({
    queryKey,
    queryFn: () => listSavedReports({ organizationId: input.organizationId!, userId: input.userId! }),
    enabled: Boolean(input.organizationId && input.userId),
  });

  const saveMutation = useMutation({
    mutationFn: (payload: {
      id?: string | null;
      name: string;
      datasetId: ReportDatasetId;
      columnKeys: readonly string[];
    }) =>
      saveReportModel({
        ...payload,
        organizationId: input.organizationId!,
        userId: input.userId!,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (model: SavedReportModel) =>
      deleteReportModel({
        organizationId: input.organizationId!,
        userId: input.userId!,
        model,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    ...query,
    saveReport: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    deleteReport: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    validateSavedReportModel,
  };
}
