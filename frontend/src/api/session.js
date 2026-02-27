import axiosInstance from "../lib/axios";

export const sessionApi = {
  createSession: async (data) => {
    const response = await axiosInstance.post("sessions", data);
    return response.data;
  },

  getActiveSessions: async () => {
    const response = await axiosInstance.get("sessions/active");
    return response.data;
  },
  getMyRecentSessions: async () => {
    const response = await axiosInstance.get("sessions/my-recent");
    return response.data;
  },

  getSessionById: async (id) => {
    const response = await axiosInstance.get(`sessions/${id}`);
    return response.data;
  },

  joinSession: async (id) => {
    const response = await axiosInstance.post(`sessions/${id}/join`);
    return response.data;
  },
  leaveSession: async (id) => {
    const response = await axiosInstance.post(`sessions/${id}/leave`);
    return response.data;
  },
  endSession: async (id) => {
    const response = await axiosInstance.post(`sessions/${id}/end`);
    return response.data;
  },
  getStreamToken: async () => {
    const response = await axiosInstance.get(`chat/token`);
    return response.data;
  },
  updateActiveProblem: async (id, activeProblemIndex) => {
    const response = await axiosInstance.patch(`sessions/${id}/active-problem`, { activeProblemIndex });
    return response.data;
  },
  addProblemToSession: async (id, problemData) => {
    const response = await axiosInstance.post(`sessions/${id}/add-problem`, problemData);
    return response.data;
  },
  deleteSession: async (id) => {
    const response = await axiosInstance.delete(`sessions/${id}`);
    return response.data;
  },
  uploadRecording: async (id, recordingBlob) => {
    const formData = new FormData();
    formData.append("recording", recordingBlob, `recording_${id}.webm`);
    const response = await axiosInstance.post(`sessions/${id}/recording`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },
};