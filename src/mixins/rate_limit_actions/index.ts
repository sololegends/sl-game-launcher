
import { RateLimit } from "rate_limit_actions";
import Vue from "vue";

export default Vue.extend({
  data(){
    return {
      rate_limit_tracking: 0,
      rate_limit_timeout: 0,
      named_rate_limit_tracking: {

      } as RateLimit.Tracker,
      named_rate_limit_timeout: {

      } as RateLimit.Tracker
    };
  },
  methods: {
    /**
     * Calls a function but with a rate limit.
     * With an option to delegate the call to after the rate limit expires for the last made call.
     * Any arguments passed after the three for this function will be passed to the target callback
     * @param {Number} rate - The time required between executions
     * @param {Boolean} delegate - Whether the function should be called on a timeout if rate blocked
     * @param {Function} callback - Function to be called
     */
    $namedRateLimitFunction({name = "default", rate = 1000, delegate = true, callback}: RateLimit.Options, ...rest_args: unknown[]){
      // Clear old timeout, if exists
      clearTimeout(this.named_rate_limit_timeout[name]);
      const args_arr = [...rest_args];
      const args = args_arr.slice(1, args_arr.length);
      const now = new Date().getTime();
      // Check the rate
      this.named_rate_limit_tracking[name] =  this.named_rate_limit_tracking[name] || 0;
      if(now - this.named_rate_limit_tracking[name] > rate){
        callback(args);
        this.named_rate_limit_tracking[name] = now;
        return;
      }
      // If we are delegating the function execute that here
      if(delegate){
        const that = this;
        const timeout_time = rate - (now - this.named_rate_limit_tracking[name]);
        // Setup a timeout call for the remaining time on the rate limit
        this.named_rate_limit_timeout[name] = setTimeout(()=>{
          that.$namedRateLimitFunction({name, rate, delegate: false, callback}, args);
        }, timeout_time) as unknown as number;
      }
    },

    /**
     * Resets the rate limit timer
     */
    $resetNamedRateLimit(name = "default"){
      this.named_rate_limit_tracking[name] = 0;
      clearTimeout(this.named_rate_limit_timeout[name]);
    },

    /**
     * Calls a function but with a rate limit.
     * With an option to delegate the call to after the rate limit expires for the last made call.
     * Any arguments passed after the three for this function will be passed to the target callback
     * @param {Number} rate - The time required between executions
     * @param {Boolean} delegate - Whether the function should be called on a timeout if rate blocked
     * @param {Function} callback - Function to be called
     */
    $rateLimitFunction(rate: number, delegate: boolean, callback: (args: unknown[]) => void, ...rest_args: unknown[]){
      // Clear old timeout, if exists
      clearTimeout(this.rate_limit_timeout);
      const args = [...rest_args];
      const now = new Date().getTime();
      // Check the rate
      if(now - this.rate_limit_tracking > rate){
        callback(args);
        this.rate_limit_tracking = now;
        return;
      }
      // If we are delegating the function execute that here
      if(delegate){
        const that = this;
        const timeout_time = rate - (now - this.rate_limit_tracking);
        // Setup a timeout call for the remaining time on the rate limit
        this.rate_limit_timeout = setTimeout(()=>{
          that.$rateLimitFunction(rate, false, callback, args);
        }, timeout_time) as unknown as number;
      }
    },

    /**
     * Resets the rate limit timer
     */
    $resetRateLimit(): void{
      this.rate_limit_tracking = 0;
      clearTimeout(this.rate_limit_timeout);
    }
  }
});