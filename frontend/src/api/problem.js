import axiosInstance from "../lib/axios";

export const problemApi = {
  getAllProblems: async () => {
    const response = await axiosInstance.get("problems");
    return response.data;
  },
  getProblemById: async (id) => {
    const response = await axiosInstance.get(`problems/${id}`);
    return response.data;
  },
  createProblem: async (data) => {
    const response = await axiosInstance.post("problems", data);
    return response.data;
  },
};
