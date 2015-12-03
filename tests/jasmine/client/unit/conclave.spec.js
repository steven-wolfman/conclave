/* global MeteorStubs */
/* global mock */
/* global spyOn */
/* global Turns */
/* global expect */
/* global getCurrentTurn */

describe('conclave general', function() {
    'use strict';

    beforeEach(function() {
        console.log("beforeEach");
        MeteorStubs.install();
    });

    afterEach(function() {
        console.log("afterEach");
        MeteorStubs.uninstall();
    });

    describe('global functions', function() {
        describe('getCurrentTurn', function() {
            it('produces the current turn when there is one', function() {
                var result = {};
                spyOn(Turns, 'findOne').and.returnValue(result);
                expect(ConclaveService.getCurrentTurn()).toBe(result);
            });
        });
    });
})
