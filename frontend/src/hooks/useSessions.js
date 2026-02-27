import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { sessionApi } from "../api/session";
import { problemApi } from "../api/problem";

export const useCreateSession = () => {
  const queryClient = useQueryClient();
  const result = useMutation({
    mutationKey: ["createSession"],
    mutationFn: sessionApi.createSession,
    onSuccess: () => {
      toast.success("Session created successfully!");
      queryClient.invalidateQueries({ queryKey: ["activeSessions"] });
    },
    onError: (error) => toast.error(error.response?.data?.message || "Failed to create room"),
  });

  return result;
};

export const useActiveSessions = () => {
  const result = useQuery({
    queryKey: ["activeSessions"],
    queryFn: sessionApi.getActiveSessions,
  });

  return result;
};

export const useMyRecentSessions = () => {
  const result = useQuery({
    queryKey: ["myRecentSessions"],
    queryFn: sessionApi.getMyRecentSessions,
  });

  return result;
};

export const useSessionById = (id) => {
  const result = useQuery({
    queryKey: ["session", id],
    queryFn: () => sessionApi.getSessionById(id),
    enabled: !!id,
    refetchInterval: 5000, // refetch every 5 seconds to detect session status changes
  });

  return result;
};

export const useJoinSession = () => {
  const queryClient = useQueryClient();
  const result = useMutation({
    mutationKey: ["joinSession"],
    mutationFn: sessionApi.joinSession,
    onSuccess: () => {
      toast.success("Joined session successfully!");
      queryClient.invalidateQueries({ queryKey: ["activeSessions"] });
    },
    onError: (error) => toast.error(error.response?.data?.message || "Failed to join session"),
  });

  return result;
};

export const useLeaveSession = () => {
  const queryClient = useQueryClient();
  const result = useMutation({
    mutationKey: ["leaveSession"],
    mutationFn: sessionApi.leaveSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activeSessions"] });
    }
  });

  return result;
};

export const useEndSession = () => {
  const queryClient = useQueryClient();
  const result = useMutation({
    mutationKey: ["endSession"],
    mutationFn: sessionApi.endSession,
    onSuccess: () => {
      toast.success("Session ended successfully!");
      queryClient.invalidateQueries({ queryKey: ["activeSessions"] });
      queryClient.invalidateQueries({ queryKey: ["myRecentSessions"] });
    },
    onError: (error) => toast.error(error.response?.data?.message || "Failed to end session"),
  });

  return result;
};

export const useUpdateActiveProblem = () => {
  const result = useMutation({
    mutationKey: ["updateActiveProblem"],
    mutationFn: ({ id, activeProblemIndex }) => sessionApi.updateActiveProblem(id, activeProblemIndex),
    onError: (error) => toast.error(error.response?.data?.message || "Failed to switch problem"),
  });

  return result;
};

export const useAddProblemToSession = () => {
  const result = useMutation({
    mutationKey: ["addProblemToSession"],
    mutationFn: ({ id, problemData }) => sessionApi.addProblemToSession(id, problemData),
    onSuccess: () => toast.success("Problem added to session!"),
    onError: (error) => toast.error(error.response?.data?.message || "Failed to add problem"),
  });

  return result;
};

export const useAllProblems = () => {
  const result = useQuery({
    queryKey: ["allProblems"],
    queryFn: problemApi.getAllProblems,
  });

  return result;
};

export const useDeleteSession = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["deleteSession"],
    mutationFn: sessionApi.deleteSession,
    onSuccess: () => {
      toast.success("Session deleted successfully!");
      queryClient.invalidateQueries({ queryKey: ["myRecentSessions"] });
      queryClient.invalidateQueries({ queryKey: ["activeSessions"] });
    },
    onError: (error) => toast.error(error.response?.data?.message || "Failed to delete session"),
  });
};