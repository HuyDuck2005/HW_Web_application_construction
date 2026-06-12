export const studentGateway = {
    async getStudent(id) {
        const request = typeof id === "object" ? id : { id };
        const response = await studentBreaker.fire(request);
        return response.student;
    }
};
export const courseGateway = {
    async getCourse(id) {
        const request = typeof id === "object" ? id : { id };
        const response = await courseBreaker.fire(request);
        return response.course;
    }
};