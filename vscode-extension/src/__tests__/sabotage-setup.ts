const SABOTAGE_MESSAGE = "Mock Sabotaged! This test is using a mock (jest.fn, jest.mock, or jest.spyOn). Real behavior testing is required.";

const throwSabotage = () => {
    throw new Error(SABOTAGE_MESSAGE);
};

// Helper to sabotage a mock object
const sabotageMock = (mock: any) => {
    const throwAndReturn = () => { throwSabotage(); return mock; };
    try {
        mock.mockImplementation(throwSabotage);
    } catch (e) { }

    const props = [
        'mockImplementation', 'mockImplementationOnce',
        'mockReturnValue', 'mockReturnValueOnce',
        'mockResolvedValue', 'mockResolvedValueOnce',
        'mockRejectedValue', 'mockRejectedValueOnce',
        'mockReturnThis', 'mockReset', 'mockClear'
    ];

    props.forEach(prop => {
        try {
            Object.defineProperty(mock, prop, {
                value: throwAndReturn,
                writable: false,
                configurable: false
            });
        } catch (e) { }
    });

    return mock;
};

// Sabotage global jest properties
if (typeof jest !== 'undefined') {
    const originalFn = jest.fn;
    const originalMock = jest.mock;
    const originalSpyOn = jest.spyOn;

    const sabotagedFn = ((...args: any[]) => sabotageMock(originalFn(...args))) as any;
    const sabotagedSpyOn = (() => { throwSabotage(); }) as any;
    const sabotagedMock = ((moduleName: string, factory?: any, options?: any) => {
        if (factory) {
            return originalMock(moduleName, () => {
                console.warn(`Attempting to mock ${moduleName} with a factory. Sabotaging...`);
                throwSabotage();
            }, options);
        }
        return originalMock(moduleName, factory, options);
    }) as any;

    try {
        Object.defineProperties(jest, {
            fn: { value: sabotagedFn, writable: false, configurable: false },
            spyOn: { value: sabotagedSpyOn, writable: false, configurable: false },
            mock: { value: sabotagedMock, writable: false, configurable: false }
        });
    } catch (e) {
        // Fallback for non-configurable properties
        (jest as any).fn = sabotagedFn;
        (jest as any).spyOn = sabotagedSpyOn;
        (jest as any).mock = sabotagedMock;
    }
}

// Also sabotage global.jest if it exists
if (typeof global !== 'undefined' && (global as any).jest) {
    const gJest = (global as any).jest;
    try {
        Object.defineProperties(gJest, {
            fn: { value: (jest as any).fn, writable: false },
            spyOn: { value: (jest as any).spyOn, writable: false },
            mock: { value: (jest as any).mock, writable: false }
        });
    } catch (e) { }
}

