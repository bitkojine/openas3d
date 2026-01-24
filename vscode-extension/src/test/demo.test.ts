import * as assert from 'assert';

describe('Demo Failure Suite', () => {
    it('this test will pass', () => {
        assert.strictEqual(1, 1);
    });

    it('this test will fail purposely', () => {
        assert.strictEqual(1, 2);
    });
});
