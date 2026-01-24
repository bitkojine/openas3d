
describe('Manual Break Test Suite (Unit/Jest)', () => {
    // -------------------------------------------------------------------------
    // INSTRUCTIONS:
    // This is a test designed to be easily "broken" manually to verify
    // that the TDD feedback loop in the 3D world is working.
    //
    // TO MAKE THIS TEST FAIL:
    // Change the `shouldPass` variable to `false`.
    //
    // TO MAKE THIS TEST PASS:
    // Change the `shouldPass` variable to `true`.
    // -------------------------------------------------------------------------

    // >>> EDIT THIS VALUE <<<
    const shouldPass = true;

    it('should reflect the manual flag state', () => {
        if (!shouldPass) {
            throw new Error('Manual break triggered! The TDD cycle works.');
        }

        // Just a dummy assertion
        const value = 1 as number;
        if (value !== 1) {
            throw new Error('Math is broken');
        }
    });
});
