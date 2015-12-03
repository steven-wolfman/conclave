/* global Mongo */

// TODO: MongoDB allows nested "databases" (?). May want to try that out for responses, if nothing else.
// In fact, may want a whole game to be one big nesty thingy. Both documents and arrays can nest.

// TODO: possibe plan: change a turn to add a list of players (array of _id from 
// TODO: Players) and a list of votes (array of _id from Responses).
//
// With that, joining becomes adding on to the player array. You can join the game
// for now up until we're in voting. The first person in the player array is the
// judge (and atomicity of documents should make that work just fine).
//
// When the turn is set up, establish 6 votes. Each vote has a unique _id and
// the respondent ID it's attached to or null if it hasn't been cast. Voting
// then becomes grabbing an unassigned vote and redirecting it to the respondent
// chosen. Unvoting is grabbing THAT PARTICULAR vote and changing it to null.
//
// Issues with the plan: Is it easy to query to get the first null entry in a
// list that sits inside a document?  


// Stripped down version assumptions:
// + All players are in the game
// + All players except the judge are responders
// + There is only one turn
// + Judging order is by player ID
Players = new Mongo.Collection("players"); /* _id (Meteor.userId()) */
Turns = new Mongo.Collection("turns"); /* _id, judgeId, challenge, isDoneVote  */ // Presently JUST ONE
Responses = new Mongo.Collection("responses"); /* _id (Meteor.userId() of respondent), text, votes, isSubmitted */


// Following
// https://github.com/meteor-velocity/velocity-examples/blob/master/leaderboard-jasmine/leaderboard.js:
// Putting all my global helpers for the moment in one singleton through which I access.
ConclaveService = {
    /**
     * Produce the current turn.
     * 
     * @returns {?document} The Meteor document representing the turn or null if there is none.
     */
    getCurrentTurn: function() {
	return Turns.findOne({});
    },

    /**
     * @returns {natural} The number of votes left to cast.
     */
    getVotesRemaining: function() {
	var votesLeft = 6;
	Responses.find({}, {
	    fields: {
		votes: 1
	    }
	}).forEach(function(resp) {
	    votesLeft = votesLeft - resp.votes;
	});
	return votesLeft;
    },

    /**
     * @returns {natural} The number of players expected to produce responses.
     */
    getNumResponders: function() {
	return Responses.find({}).count();
    },

    /**
     * @returns {natural} The number of responses expected per player.
     */
    getNumResponsesPerPlayer: function() {
	// TODO: set up 3-player games to take in 2 responses per player.
	//return getNumResponders() < 3 ? 2 : 1;
	return 1;
    },

    /**
     * @returns {natural} The total number of expected responses.
     */
    getNumExpectedResponses: function() {
	return ConclaveService.getNumResponsesPerPlayer() * ConclaveService.getNumResponders();
    },

    /**
     * @returns {boolean} Have all players expected to respond submitted responses?
     */
    haveAllPlayersResponded: function() {
	var turn = ConclaveService.getCurrentTurn();

	// Double-check that:
	// 1) No one is listed as unsubmitted, and
	// 2) everyone is listed as submitted.
	return turn &&
	    Responses.find({
		isSubmitted: false
	    }).count() === 0 &&
	    (Players.find({ // non-judges
		    _id: {
			$ne: turn.judgeId
		    }
	    }).map(elt => Responses.find({ // that have submitted (count is 1)
		_id: elt._id,
		isSubmitted: true
	    }).count() === 1).every(x => x));
    },

    /**
     * An "isIn" function for determining what state the UI is in.
     * 
     * @returns {boolean} Is the current player the judge in the process of making the challenge?
     */
    isInJudgeMakingChallenge: function() {
	// To be in "judge making challenge" state:
	// + This player is the judge
	// + There is no challenge yet
	// ASSUMPTION: only one turn.
	var turn = ConclaveService.getCurrentTurn();
	var uid = Meteor.userId();

	return turn && uid &&
	    // I am the judge, and
	    turn.judgeId === uid &&
	    // There is no challenge
	    !turn.challenge;
    },

    /**
     * An "isIn" function for determining what state the UI is in.
     * 
     * @returns {boolean} Is the user in need of authentication before proceeding?
     */
    isInAuthenticating: function() {
	return !Meteor.userId();
    },

    /**
     * An "isIn" function for determining what state the UI is in.
     * 
     * @returns {boolean} Is the user looking for a game to participate in?
     */
    isInFindingGame: function() {
	// ASSUMPTION: all players are in a single game.
	// Then, if we're in players, we're in a game.

	var uid = Meteor.userId();

	return uid &&
	    // I am not a player.
	    (Players.find({
		_id: uid
	    }).count() === 0);
    },

    /**
     * An "isIn" function for determining what state the UI is in.
     * 
     * @returns {boolean} Is the current player the judge awaiting outstanding responses to their challenge?
     */
    isInJudgeAwaitingResponses: function() {
	var uid = Meteor.userId();
	var turn = ConclaveService.getCurrentTurn();

	return turn && uid &&
	    // I am a judge, and
	    (turn.judgeId === uid) &&
	    // There is a challenge, but
	    turn.challenge &&
	    // not all players have responded.
	    !ConclaveService.haveAllPlayersResponded();
    },

    /**
     * An "isIn" function for determining what state the UI is in.
     * 
     * @returns {boolean} Is the current player the judge in the process of voting on submitted responses?
     */
    isInJudgeVoting: function() {
	var uid = Meteor.userId();
	var turn = ConclaveService.getCurrentTurn();

	return turn && uid &&
	    // I am the judge and
	    turn.judgeId === uid &&
	    // There is a challenge and
	    turn.challenge &&
	    // All players have responded but
	    ConclaveService.haveAllPlayersResponded() &&
	    // I am not done voting
	    !turn.isDoneVote;
    },

    /**
     * An "isIn" function for determining what state the UI is in.
     * 
     * @returns {boolean} Is the current player a respondent awaiting the judge's votes on responses?
     */
    isInRespondentAwaitingVoting: function() {
	var uid = Meteor.userId();
	var turn = ConclaveService.getCurrentTurn();

	return turn && uid &&
	    // I am NOT the judge and
	    turn.judgeId !== uid &&
	    // There is a challenge and
	    turn.challenge &&
	    // All players have responded but
	    ConclaveService.haveAllPlayersResponded() &&
	    // the judge is not done voting
	    !turn.isDoneVote;
    },

    /**
     * An "isIn" function for determining what state the UI is in.
     * 
     * @returns {boolean} Is the current player a respondent awaiting the judge's challenge?
     */
    isInRespondentAwaitingChallenge: function() {
	var uid = Meteor.userId();
	var turn = ConclaveService.getCurrentTurn();

	return turn && uid &&
	    // I am not a judge, and
	    turn.judgeId !== uid &&
	    // there is no current challenge
	    !turn.challenge;
    },

    /**
     * An "isIn" function for determining what state the UI is in.
     * 
     * @returns {boolean} Is the current player a respondent creating a response to a challenge?
     */
    isInRespondentResponding: function() {
	var uid = Meteor.userId();
	var turn = ConclaveService.getCurrentTurn();

	return turn && uid &&
	    // I am not a judge, and
	    turn.judgeId !== uid &&
	    // there is a challenge, and
	    turn.challenge &&
	    // I have not responded
	    Responses.find({
		_id: uid,
		isSubmitted: true
	    }).count() == 0;
    },

    /**
     * An "isIn" function for determining what state the UI is in.
     * 
     * @returns {boolean} Is the current player's game over?
     */
    isInGameOver: function() {
	var turn = ConclaveService.getCurrentTurn();

	return turn && Meteor.userId() &&
	    // Voting is done
	    turn.isDoneVote;
    }
}

/**
 * The possible states of the UI. Each state should have a unique
 * name (name is a string), the name of the template to display
 * for the UI (templateName is a string), and a to: function
 * determine whether the user is in this UI state (isIn is a
 * zero-argument function producing a boolean).
 */
UI_STATES = {
    JUDGE_MAKING_CHALLENGE: {
	name: "Making challenge",
	templateName: "makeChallenge",
	isIn: ConclaveService.isInJudgeMakingChallenge
    },
    AUTHENTICATING: {
	name: "Logging in",
	templateName: "nobody",
	isIn: ConclaveService.isInAuthenticating
    },
    FINDING_GAME: {
	name: "Finding a game",
	templateName: "join",
	isIn: ConclaveService.isInFindingGame
    },
    RESPONDENT_AWAITING_CHALLENGE: {
	name: "Waiting for judge to issue challenge",
	templateName: "wait",
	isIn: ConclaveService.isInRespondentAwaitingChallenge
    },
    RESPONDENT_AWAITING_VOTING: {
	name: "Waiting for judge to cast votes",
	templateName: "wait",
	isIn: ConclaveService.isInRespondentAwaitingVoting
    },
    JUDGE_AWAITING_RESPONSES: {
	name: "Waiting for players to respond",
	templateName: "judgeAwaitsResponses",
	isIn: ConclaveService.isInJudgeAwaitingResponses
    },
    JUDGE_VOTING: {
	name: "Voting on responses",
	templateName: "voteOnResponses",
	isIn: ConclaveService.isInJudgeVoting
    },
    RESPONDENT_RESPONDING: {
	name: "Making a response",
	templateName: "makeResponse",
	isIn: ConclaveService.isInRespondentResponding
    },
    GAME_OVER: {
	name: "Game over",
	templateName: "endGame",
	isIn: ConclaveService.isInGameOver
    },
    /**
     * Never supposed to be produced. I have it here in hopes that I'll default to it if all else fails!
     */
    CONFUSED: {
	name: "Confused",
	templateName: "confused",
	isIn: function() {
	    return true;
	}
    }
}


Meteor.methods({
  /**
   * Try to become the judge of the current turn.
   * 
   * @returns {boolean} whether the player is now the judge
   */
  tryBecomeJudge: function() {
    var uid = Meteor.userId();
    var turn = Turns.findOne({});
    console.log(uid);
    console.log(turn);
    if (uid && turn && Turns.update({
        _id: turn._id,
        judgeId: null // may want to test whether $exists: false as option
      }, {
        $set: {
          judgeId: uid
        }
      }) > 0) {
      // At least one (and hopefully exactly one!) document updated; success!
      return true;
    }
    else {
      return false;
    }
  }
});

if (Meteor.isClient) {
  /**
   * @function numToIterable
   * 
   * Global helper that allows use of an each block to iterate over 0..(n-1).
   * @param {natural} n
   * @returns {natural[]} the array [0, 1, ..., n-1]
   */
  Template.registerHelper("numToIterable",
    function(n) {
      var a = [];
      for (var i = 0; i < n; i++)
        a[i] = i;
      return a;
    }
  );

  /**
   * @function responses
   * 
   * Global helper.
   * @returns {Meteor.cursor} all responses for the current turn
   */
  Template.registerHelper("responses", function() {
    return Responses.find({});
  });

  /**
   * @function players
   * 
   * Global helper.
   * @returns {Meteor.cursor} all players for the current game
   */
  Template.registerHelper("players", function() {
    return Players.find({});
  });

  /**
   * @function getVotesRemaining
   * 
   * Global helper.
   * @returns {natural} The number of votes left to cast in the current turn.
   */
  Template.registerHelper("getVotesRemaining", ConclaveService.getVotesRemaining);

  /**
   * @function areAllVotesIn
   * 
   * Global helper.
   * @returns {boolean} Has the judge allocated all their available votes?
   */
  Template.registerHelper("areAllVotesIn", function() {
    return ConclaveService.getVotesRemaining() == 0;
  });

  /**
   * @function getNumResponsesPerPlayer
   * 
   * Global helper.
   * @returns {natural} The number of responses expected per player.
   */
  Template.registerHelper("getNumResponsesPerPlayer", ConclaveService.getNumResponsesPerPlayer);

  Template.body.helpers({
    /**
     * Determine the template to use for a dynamic template inclusion.
     * 
     * @returns {?string} the name of the template to use to display the current state of the game
     */
    getCurrentTemplate: function() {
      for (var uiState in ConclaveService.UI_STATES) {
        if (ConclaveService.UI_STATES[uiState].isIn())
          return ConclaveService.UI_STATES[uiState].templateName;
      }
      return null;
    }
  });

  Template.responsesReceived.helpers({
    /**
     * @returns {natural} the number of submitted responses in the current turn
     */
    getNumResponses: function() {
      return Responses.find({
        isSubmitted: true
      }).count();
    },

    /**
     * @returns {natural} the total number of responses expected in the current turn
     */
    getNumExpectedResponses: function() {
      return ConclaveService.getNumExpectedResponses();
    }
  });
  Template.join.events({
    /**
     * Join a game, becoming the judge if no one else is yet.
     */
    "click .join": function(event) {
      var uid = Meteor.userId();
      var turn = ConclaveService.getCurrentTurn();
      console.log(Players.insert({
        _id: uid
      }));

      // Become judge, if there is no judge now.
      // I BELIEVE that per https://docs.mongodb.org/manual/core/write-operations-atomicity/ and https://docs.mongodb.org/manual/tutorial/model-data-for-atomic-operations/, this will never make someone the judge if someone else already is. (Maybe!)
      console.log(Meteor.call("tryBecomeJudge"));

      // Refetch the turn to see if I'm judge and to get the updated turn document.
      turn = ConclaveService.getCurrentTurn();

      // If I'm not the judge, prep my response row:
      if (turn.judgeId !== uid) {
        console.log(Responses.upsert({
          _id: uid,
        }, {
          _id: uid,
          text: null,
          votes: 0,
          isSubmitted: false
        }));
      }
    }
  });
  Template.makeResponse.helpers({
    /**
     * @returns {?string} the text of this turn's challenge
     */
    getChallenge: function() {
      var turn = ConclaveService.getCurrentTurn();
      return turn && turn.challenge;
    }
  });
  Template.makeResponse.events({
    /**
     * Unsubmit a response when the respondent is clearly mucking with it more.
     */
    "focus .responseEntryBox": function(event) {
      // Set myself up to see other properties of the event in
      // browser console.
      console.log(event);

      var uid = Meteor.userId();
      console.log(Responses.update({
        _id: uid
      }, {
        $set: {
          isSubmitted: false
        }
      }));
    },
    /**
     * Submit the respondent's response.
     */
    "submit .makeResponse": function(event) {
      // Set myself up to see other properties of the event in
      // browser console.
      console.log(event);

      // Prevent default browser form submit
      event.preventDefault();

      // Get value from form element
      console.log(event.target.text);
      var text = event.target.text.value;
      console.log(text);
      var uid = Meteor.userId();
      console.log(uid);

      console.log(Responses.update({
        _id: uid
      }, {
        $set: {
          text: text,
          isSubmitted: true
        }
      }));

      /*
      var boxes = Template.instance().findAll(".responseEntryBox");
      var box;
      console.log(boxes);
      for (var i = 0; i < boxes.length; i++) {
        box = boxes[i];
        console.log(box);
        console.log(Responses.update({
          _id: uid
        }, {
          $set: {
            text: box.value,
            isSubmitted: true
          }
        }));
        // Clear the box.
        box.value = "";
      }
      */
    }
  });
  Template.voteOnResponses.events({
    /**
     * Submit the judge's votes.
     */
    "click .sendVotesButton": function(event) {
      // Sigh: again, not quite sure how to REALLY guarantee that this only
      // sends if all votes (and no more than all votes) are in. Even the
      // server side can have problems with race conditions.
      //
      // See discussion in unvote and vote clicks about the possibility of
      // having vote objects, which might help.
      var turn = ConclaveService.getCurrentTurn();

      Turns.update({
        _id: turn._id
      }, {
        $set: {
          isDoneVote: true
        }
      });
    }
  })
  Template.voteResponse.events({
    /**
     * Vote on the response
     * @this must have an _id field for a response
     */
    "click .voteButton": function(event) {
      // There's some ugliness here in that the increment could result 
      // in too many total votes. Possible fixes: complex cruft about counting
      // votes or have votes be actual documents that have a response they're
      // assigned to and assign the first unassigned one in here.
      Responses.update({
        _id: this._id
      }, {
        $inc: {
          votes: 1
        }
      });
    },
    /**
     * Remove a vote for the response
     * @this must have an _id field for a response
     */
    "click .unvoteButton": function(event) {
      // There's some ugliness here in that the increment could result 
      // in fewer than zero votes. Possible fixes: cruft about counting
      // votes or have votes be actual documents that have a response they're
      // assigned to and assign this particular vote to be unassigned.
      Responses.update({
        _id: this._id
      }, {
        $inc: {
          votes: -1
        }
      });
    }
  });
  Template.endGame.helpers({
    /**
     * @returns {?string} the name of the current player
     */
    getPlayerName: function(pid) {
      var user = Meteor.users.findOne({
        _id: pid
      }, {
        username: 1
      });
      return user && user.username;
    },
    /**
     * @returns {?natural} the current player's score
     */
    getPlayerScore: function(pid) {
      var results = Responses.find({
        _id: pid
      }, {
        votes: 1
      });
      if (results.count() == 0)
        return null;

      var score = 0;
      results.forEach(function(r) {
        score = score + r.votes;
      });
      return score;
    }
  });
  Template.makeChallenge.events({
    /**
     * Submit the challenge text
     * @param {Object.target.text} an event whose target is a text field with the challenge text
     */
    "submit .makeChallenge": function(event) {
      // Set myself up to see other properties of the event in
      // browser console.
      console.log(event);

      // Prevent default browser form submit
      event.preventDefault();

      // Get value from form element
      var text = event.target.text.value;

      var turn = ConclaveService.getCurrentTurn();
      console.log(Turns.update({
        _id: turn._id
      }, {
        $set: {
          challenge: text
        }
      }));

      // In case I want to clear the form.
      //event.target.text.value = "";
    }
  });

  Accounts.ui.config({
    passwordSignupFields: "USERNAME_ONLY"
  });

}

if (Meteor.isServer) {
  Meteor.startup(function() {
    // code to run on server at startup

    // TODO: initialize the DB in some reasonable way
    // For now, I clear out players and responses and set up a first turn.
    Players.remove({});
    Turns.remove({});
    Responses.remove({});

    // Debugging make response:
    /*
    Turns.insert({
      judgeId: "fGMF5gYk2C4W7aRwa",
      challenge: "aoeu",
      isDoneVote: false
    });
    Players.insert({
      _id: "fGMF5gYk2C4W7aRwa"
    });
    Players.insert({
      _id: "YBgDeNWt4WgkHksro"
    });
    Responses.insert({
      _id: "YBgDeNWt4WgkHksro",
      text: null,
      votes: 0,
      isSubmitted: false
    });
    */

    // Blank game:
    Turns.insert({
      judgeId: null,
      challenge: null,
      isDoneVote: false
    });
  });
}
