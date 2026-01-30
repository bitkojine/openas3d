export const cruise = jest.fn().mockImplementation(() => {
    throw new Error("Mock Sabotaged! dependency-cruiser.cruise should not be called in a real test.");
});
export const ICruiseResult = {};
export const IModule = {};
