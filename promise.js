"use strict";

/**
 * Promise.js returns a Deferred object which supports the jQuery deferred api but without
 * 		the requirement on jQuery.  Its also more performant than jQuery deferred and when JS, 
 *   	a bit less performant than vow.js but it does the difference between the deferred object and the 
 *    promise object better, (whereas vow does not).
 * @closure returns a Deferred @constructor
 * @notes Read this if you don't understand public/private/privelege in JS 
 *        http://javascript.crockford.com/private.html
 *        there is a cost to defining all of these functions in the constructor... 
 *        but that cost in very few instnaces is merited by the encapsulation gains
 * @returns {Deferred} Deferred constructor
**/
(function() {
	//temp helper function since this promise lib should be stand alone and not dependant on any
	//unerscore or utility library
	function extend(dest, source) {	for(var prop in source) {	dest[prop] = source[prop]; } return dest; }


	/**
	 * callback recieves a scope and data as well as a list of callbacks to execute
	 * 		it proceeds to call all of those callbacks with the scope and data provided
	 * @function
	 * @private to this closure
	 * @param {object} scope - the scope with which to call the callback
	 * @param {object} data - data to pass as the argument of the callback
	 * @param {array[function]} cbs - an array of callback functions
	 * @return {null} null
	**/
	function callback(scope, data, cbs) {
		return function() {
	  		for(var i=0; i<cbs.length; i++) {
				cbs[i].call(scope, data);
			}
		};
	}

	/**
	 * sanitizeCbs ensures that the callbacks are returns in an array format
	 * 		this is a helper function to keep it from being used all over the place below
	 * @function
	 * @private to this closure
	 * @param {array[functions] || function} - cbs, either an array of functions or a single function
	 * @return {array[function]} - returns an array of functions
	**/
	function sanitizeCbs(cbs) {
		if(cbs && {}.toString.call(cbs) !== '[object Array]') {
    	cbs = [cbs]
    }
		return cbs;
	}
	
	/**
	 * Represents a Deferred Object
	 * @constructor
	 * @param {function} beforeStart - an optional function to be called before
	 *                               the deferred starts up
	 * @returns {deferred} the deferred instance object
	**/
	var Dfd = function(beforeStart, debugMode) {
		//setup some instance parameters
		//internalState 0 == pending, 1 == resolved, 2 == rejected
		this.internalState = 0;
		this.internalWith = this;
		this.internalData = null;
		this.callbacks = {
			done    : [],
			fail    : [],
			always  : [],
			progress: [],
		}
		
		//if beforeStart is passed then call it with this being the deferred
		if(beforeStart && {}.toString.call(beforeStart) === '[object Function]') {
    	beforeStart.call(this, this);
    }

     if(!debugMode) {
		  Object.defineProperties(this, {
			  "internalState": {enumerable:false, writable:true, configurable:false},
			  "internalWith": {enumerable:false, writable:true, configurable:false},
			  "internalData": {enumerable:false, writable:true, configurable:false},
			  "callbacks": {enumerable:false, writable:false, configurable:false},
			});
  		//Freeze the this so that the functions cannot be changed/overridden nor modified
			Object.seal(this);
   		//Freeze the prototype so that the functions cannot be changed/overridden nor modified
			Object.freeze(Dfd.prototype);
		}
		return this;
	}

	//extend the Deferred prototype with the functions that it needs.
	//This is a performance/security tradeoff in tht these functions are 
	//kinda exposed (even though we freeze them below), but they are on
	//the prototype chain so tht you could extend this object and add things
	//or overload some prototype methods
	extend(Dfd.prototype, {
		toString: function() {
			return "[object Deferred]";
		},

		/**
		 * Represents a Promise Object.  If target is supplied and is an object
		 * 		then we will turn that target object into the promise 
		 * 		by extending it with the promise functions
		 * 		instead of creating a new promise
		 * @constructor
		 * @param {deferred} Dfd - the linked Deferred instance
		 * @param {object} target - the target object
		 * @returns {promise} the promise instance object
		**/
		Promise: function(dfd, target) {
			this.toString = function() {
				return "[object Promise]";
			}
			this.done = dfd.done.bind(dfd);
			this.fail = dfd.fail.bind(dfd);
			this.progress = dfd.progress.bind(dfd);
			this.always = dfd.always.bind(dfd);
			this.then = dfd.then.bind(dfd);
			this.state = dfd.state.bind(dfd);

			//if target was passed in then return the ='promisified' target 
			//intead of a new promise object
			if(target && {}.toString.call(target) === '[object Object]') {
				extend(target, this);
				return target;
			}
			return this;
		},

		/**
		 * notify will call any progress callbacks with the data provided
		 * @function
		 * @public on prototype
		 * @param {object} data - the data to notify with 
		 * @return {null} null
		**/
		notify: function(data) {
			if(this.state() == 0) {
				this.internalData = data;
				setTimeout(callback(
					this.internalWith, 
					this.internalData, 
					this.callbacks.progress)
				,0);
			}
			return;
		},
		
		/**
		 * notifyWith will call any progress callbacks with the data provided 
		 * 		using the scope provided
		 * @function
		 * @public on prototype
		 * @param {object} scope - the scope to call the progress callbacks with
		 * @param {object} data - the data to notify with 
		 * @return {null} null
		**/
		notifyWith: function(scope, data) {
			if(this.state() == 0) {
				this.internalWith = scope;
				this.internalData = data;
				setTimeout(callback(
					this.internalWith, 
					this.internalData, 
					this.callbacks.progress)
				,0);
			}
			return;
		},
		
		/**
		 * reject will call any fail callbacks with the data provided, as well as always callbacks
		 * @function
		 * @public on prototype
		 * @param {object} data - the data to reject with 
		 * @return {null} null
		**/
		reject: function(data) {
			if(this.state() == 0) {
				this.internalData = data;
				this.setState(2)
				setTimeout(callback(
					this.internalWith, 
					this.internalData, 
					this.callbacks.fail.concat(this.callbacks.always)
				),0);
			}
			return;
		},
		
		/**
		 * rejectWith will call any fail and always callbacks with the data provided 
		 * 		using the scope provided
		 * @function
		 * @public on prototype
		 * @param {object} scope - the scope to call the callbacks with
		 * @param {object} data - the data to reject with 
		 * @return {null} null
		**/
		rejectWith: function(scope, data) {
			if(this.state() == 0) {
				this.internalWith = scope;
				this.internalData = data;
				this.setState(2)
				setTimeout(callback(
					this.internalWith, 
					this.internalData, 
					this.callbacks.fail.concat(this.callbacks.always)
				),0)
			}
			return;
		},
		
		/**
		 * resolve will call any done and always callbacks with the data provided
		 * @function
		 * @public on prototype
		 * @param {object} data - the data to resolve with 
		 * @return {null} null
		**/
		resolve: function(data) {
			if(this.state() == 0) {
				this.internalData = data;
				this.setState(1)
				setTimeout(callback(
					this.internalWith, 
					this.internalData, 
					this.callbacks.done.concat(this.callbacks.always)
				),0)
			}
			return;
		},
		
		/**
		 * resolveWith will call any done and always callbacks with the data provided
		 *  	using the scope provided
		 * @function
		 * @public on prototype
		 * @param {object} scope - the scope to call the callbacks with
		 * @param {object} data - the data to notify with 
		 * @return {null} null
		**/
		resolveWith: function(scope, data) {
			if(this.state() == 0) {
				this.internalWith = scope;
				this.internalData = data;
				this.setState(1)
				setTimeout(callback(
					this.internalWith, 
					this.internalData, 
					this.callbacks.done.concat(this.callbacks.always)
				),0)
			}
			return;
		},

		/**
		 * always will set a callback for the resolve and reject events
		 * 		or will immediatly run the callback if the object is already
		 *   	resolved or rejected.
		 * @function
		 * @public on prototype
		 * @param {function || array[function]} cbs - a callback function or an array
		 *                     of callback functions
		 * @return {null} null
		**/
		always: function(cbs) {
			cbs = sanitizeCbs(cbs);
			if(cbs.length > 0) {
				if(this.state() !== 0) {
					setTimeout(callback(
						this.internalWith, 
						this.internalData, 
						cbs)
					,0);
				} else {
					this.callbacks.always = this.callbacks.always.concat(cbs)
				}
			}
			return;
		},
		
		/**
		 * done will set a callback for the resolve events
		 * 		or will immediatly run the callback if the object is already
		 *   	resolved.
		 * @function
		 * @public on prototype
		 * @param {function || array[function]} cbs - a callback function or an array
		 *                     of callback functions
		 * @return {null} null
		**/
		done: function(cbs) {
			cbs = sanitizeCbs(cbs);
			if(cbs.length > 0) {
				if(this.state() === 1) {
					setTimeout(callback(
						this.internalWith, 
						this.internalData, 
						cbs)
					,0);
				} else {
					this.callbacks.done = this.callbacks.done.concat(cbs)
				}
			}
			return;
		},
		
		/**
		 * fail will set a callback for the reject events
		 * 		or will immediatly run the callback if the object is already
		 *   	rejected.
		 * @function
		 * @public on prototype
		 * @param {function || array[function]} cbs - a callback function or an array
		 *                     of callback functions
		 * @return {null} null
		**/
		fail: function(cbs) {
			cbs = sanitizeCbs(cbs);
			if(cbs.length > 0) {
				if(this.state() === 2) {
					setTimeout(callback(
						this.internalWith, 
						this.internalData, 
						cbs)
					,0);
				} else {
					this.callbacks.fail = this.callbacks.fail.concat(cbs)
				}
			}
			return;
		},
		
		/**
		 * progress will set a callback for the notify events, or do nothing
		 * 		if it is already resolved or rejected
		 * @function
		 * @public on prototype
		 * @param {function || array[function]} cbs - a callback function or an array
		 *                     of callback functions
		 * @return {null} null
		**/
		progress: function(cbs) {
			if(this.state() === 0) {
				cbs = sanitizeCbs(cbs);
				this.callbacks.progress = this.callbacks.progress.concat(cbs)
			}
			return;
		},

		/**
		 * then provides a function which allows chaining of promise callbacks essentialy
		 * 		it allows you to provide filter functions that will be called upone the origional promise
		 * 		which may modify/alter the data before returning/resolving/rejecting the newly
		 * 		created deferred/promise.
		 * @function
		 * @public on prototype
		 * @param {function} doneFilter - a function to be run on the resolve event and whose return value
		 *                              will be used to resolve the promise returned by the "then"
		 * @param {function} failFilter - a function to be run on the reject event and whose return value
		 *                              will be used to reject the promise returned by the "then"
		 * @param {function} progressFilter - a function to be run on the notify event and whose return value
		 *                              will be used to notify the promise returned by the "then"
		 * @return {null} null
		**/
		then: function(doneFilter, failFilter, progressFilter) {
			//create a new inner DFD function
			var newDfd = new Dfd;
			
			var dF = function(data) {
				var ret = doneFilter.call(this, data);
				newDfd.resolveWith(this, ret);
			}
			var fF = function(data) {
				var ret = failFilter.call(this, data);
				newDfd.rejectWith(this, ret);
			}
			var pF = function(data) {
				var ret = progressFilter.call(this, data);
				newDfd.notifyWith(this, ret);
			}
			this.done(dF); this.fail(fF); this.progress(pF);

			return newDfd.promise();
		},

		/**
		 * When can take an array of promised or truthy/falsey objects
		 * 		and can mesh them into a single promise/deferred which will
		 * 		be resolved when all of the passed in promises resolve, or rejected if
		 * 		any of the passed in promises is rejected.  It returns a promise in 
		 * 		its own right which can represent the summation of all the inner
		 * 		promises.
		 * @function
		 * @public on prototype
		 * @return {promise} promise instance object
		**/
		when: function(promises) {
			var newDfd = new Dfd();
			var resolvedCount = 0;
			var handledCount = 0;
			var whenData = [];

			for(var i = 0; i<promises.length; i++) {
				var tempI = i;
				//if it is a promise object
				if(promises[i].toString() === "[object Promise]") {
					//when the promise is done store the data into the whenData array
					//and resolve the new whenDeferred if all the promises are resolved
					promises[i].done(function(data) {
						whenData[tempI] = data;
						resolvedCount++; handledCount++;
						if(resolvedCount === promises.length) {
							newDfd.resolve(data);
						}
					});
					//if one of the inner promises fails then we store that fail and the 
					//when wrapper will also fail but only after running all of the promises
					//such that the returned composite data is indicative of the status of all of the 
					//wrapped promises
					promises[i].fail(function(e) {
						handledCount++;
						whenData[tempI] = e;
						if(handledCount === promises.length) {
							newDfd.reject(whenData);
						}
					});
					//simply pass along progress events with no need to chain them etc.
					promises[i].progress(function(e) {
						newDfd.notify(e);
					});
				} 
				//otherwise if it is truthy value
				//then use that value to return in the callback and 
				//increment the resolvedCount
				else if (promises[i]) {
					whenData[i] = promises[i];
					resolvedCount++; handledCount++;
				} 
				//otherwise if it is falsy
				//then use that valu to return in the callback
				//and increment only the handledCount not the 
				//resolved Count.  This means the when will eventually 
				//reject.
				else {
					whenData[i] = promises[i];
					handledCount++;
				}
			};

			// if all of the "promises" were not actually promises but rather truthy or falsey objects
			// then we can determine the state right now syncrounously after the for loop
			// instead of waiting for inner promise callbacks etc
			if(resolvedCount === promises.length) {
				newDfd.resolve(whenData);
			} else if (handledCount === promises.length) {
				newDfd.reject(whenData);
			}
			return newDfd.promise();
		},
		
		/**
		 * getter for the dfd's promise
		 * 		The promise is the only thing which should be passed
		 * 		to untrusted other functions, and is all that is needed
		 * 		to setup callbacks on notify/resolve/reject events.
		 * 		The promise cannot be used to "escalate" to the deferred
		 * @function
		 * @public on prototype
		 * @return {promise} promise instance object
		**/
		promise: function(target) {
			var pro = new this.Promise(this, target);
			return pro;
		},

		/**
		 * getter for the internalState property
		 * @function
		 * @public on prototype
		 * @return {int} internalState integer
		**/
		state: function() {
			return this.internalState;
		},

		/**
		 * setter for the internalState property
		 * @function
		 * @public on prototype
		 * @param {int} newState - state int, 0 is pending, 1 is resolved, 2 is rejected
		 * @return {int} internalState integer
		**/
		setState: function(newState) {
			if(newState == 0 || newState == 1 || newState == 2) {
				this.internalState = newState;
			}
			return this.internalState;
		}
	});
	
	//set this to the utility namespace 
	self._u_ = self._u_ || {};
	self._u_.Dfd = Dfd;

	//and also return the Constructor so that it could be saved and used directly
	return Dfd;
})();

