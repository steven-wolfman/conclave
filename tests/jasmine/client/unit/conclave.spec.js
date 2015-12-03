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

	describe('getVotesRemaining', function() {
	    it('produces 6 votes when no one has voted', function() {
		spyOn(Responses, 'find').and.returnValue([]);
		expect(ConclaveService.getVotesRemaining()).toBe(6);
		// This doesn't seem critical to test:
		//expect(Responses.find).toHaveBeenCalledWith({}, {fields: {votes: 1}});
		
		Responses.find.and.returnValue([{votes: 0}, {votes: 0}, {votes: 0}]);
		expect(ConclaveService.getVotesRemaining()).toBe(6);
	    });

	    it('produces (6 - total votes) when people have voted', function() {
		spyOn(Responses, 'find').and.returnValue([
		    {votes:3},
		    {votes:0},
		    {votes:1}
		]);
		expect(ConclaveService.getVotesRemaining()).toBe(2);

		Responses.find.and.returnValue([
		    {votes:6},
		]);
		expect(ConclaveService.getVotesRemaining()).toBe(0);
	    });
	});

	describe('getNumResponders', function() {
	    it('produces thet total number of entries in responses', function() {
		spyOn(Responses, 'find').and.returnValue({
		    count: function() { return 0; }
		});
		expect(ConclaveService.getNumResponders()).toBe(0);
		expect(Responses.find).toHaveBeenCalledWith({});

		Responses.find.and.returnValue({
		    count: function() { return 3; }
		});
		expect(ConclaveService.getNumResponders()).toBe(3);
	    });
	});

	describe('getNumResponsesPerPlayer', function() {
	    it('always produces 1', function() {
		expect(ConclaveService.getNumResponsesPerPlayer()).toBe(1);
	    });
	});

	describe('getNumExpectedResponses', function() {
	    it('produces number of responses per player * number of responders',
	       function() {
		   spyOn(ConclaveService, 'getNumResponsesPerPlayer').and.returnValue(3);
		   spyOn(ConclaveService, 'getNumResponders').and.returnValue(8);
		   expect(ConclaveService.getNumExpectedResponses()).toBe(24);

		   ConclaveService.getNumResponsesPerPlayer.and.returnValue(1);
		   ConclaveService.getNumResponders.and.returnValue(4);
		   expect(ConclaveService.getNumExpectedResponses()).toBe(4);
	       });
	});

	describe('haveAllPlayersResponded', function() {
	    it('is not true if there is no current turn', function() {
		spyOn(ConclaveService, 'getCurrentTurn');

		ConclaveService.getCurrentTurn.and.returnValue(null);
		expect(ConclaveService.haveAllPlayersResponded()).not.toBe(true);

		ConclaveService.getCurrentTurn.and.returnValue(undefined);
		expect(ConclaveService.haveAllPlayersResponded()).not.toBe(true);
	    }); 

	    it('is not true if anyone is listed as unsubmitted', function() {
		spyOn(ConclaveService, 'getCurrentTurn').and.returnValue({judgeId: "test"});

		spyOn(Responses, 'find');
		Responses.find.and.returnValue({count: function() { return 1; }});
		expect(ConclaveService.haveAllPlayersResponded()).not.toBe(true);
		expect(Responses.find).toHaveBeenCalledWith({isSubmitted: false});

		Responses.find.and.returnValue({count: function() { return 3; }});
		expect(ConclaveService.haveAllPlayersResponded()).not.toBe(true);
	    }); 

	    it('is not true if anyone is listed as unsubmitted', function() {
		spyOn(ConclaveService, 'getCurrentTurn').and.returnValue({judgeId: "test"});

		spyOn(Responses, 'find');
		Responses.find.and.returnValue({count: function() { return 1; }});
		expect(ConclaveService.haveAllPlayersResponded()).not.toBe(true);
		expect(Responses.find).toHaveBeenCalledWith({isSubmitted: false});

		Responses.find.and.returnValue({count: function() { return 3; }});
		expect(ConclaveService.haveAllPlayersResponded()).not.toBe(true);
	    }); 

	    // TODO: this seems a bit nuts. Would rather test with
	    // cursors and DB initialization at this point!

	    // it('is not true if anyone is not listed at all in responses', function() {
	    // 	spyOn(ConclaveService, 'getCurrentTurn').and.returnValue({judgeId: "test"});
	    // 	spyOn(Players, 'find');
	    // 	spyOn(Responses, 'find');
	    // 	Responses.find.and.returnValue(...);

	    // 	Players.find.and.returnValue(


	    // 	spyOn(Responses, 'find');
	    // 	Responses.find.and.returnValue({count: function() { return 1; }});
	    // 	expect(ConclaveService.haveAllPlayersResponded()).not.toBe(true);
	    // 	expect(Responses.find).toHaveBeenCalledWith({isSubmitted: false});

	    // 	Responses.find.and.returnValue({count: function() { return 3; }});
	    // 	expect(ConclaveService.haveAllPlayersResponded()).not.toBe(true);
	    // }); 
	});
    });
})
