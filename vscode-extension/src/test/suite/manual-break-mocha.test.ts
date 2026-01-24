
import * as assert from 'assert';

suite('Manual Break Test Suite (Integration/Mocha)', () => {
    // -------------------------------------------------------------------------
    // INSTRUCTIONS:
    // This is a test designed to be easily "broken" manually to verify
    // that the TDD feedback loop in the VSCode Extension Host is working.
    //
    // TO MAKE THIS TEST FAIL:
    // Change the `shouldPass` variable to `false`.
    //
    // TO MAKE THIS TEST PASS:
    // Change the `shouldPass` variable to `true`.
    // -------------------------------------------------------------------------

    // >>> EDIT THIS VALUE <<<
    const shouldPass = true;

    test('should reflect the manual flag state', () => {
        if (!shouldPass) {
            assert.fail('Manual break triggered! The TDD cycle works.');
        }

        // Just a dummy assertion
        assert.strictEqual(1, 1);
    });
});
