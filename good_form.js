/** GoodForm 0.5
 *
 * http://github.com/cementhorses/good_form
 *
 * Copyright (c) 2008-* Stephen Celis. Released by Cement Horses under the MIT
 * License. Active Record validations and documentation liberally extracted and
 * modified.
 *
 * Rails developers will find a nice little bridge here:
 *
 * http://github.com/cementhorses/good_form_rails
 *
 *
 *** The gist:
 *
 * - Library-agnostic!
 * - Unit-tested!
 * - Ajax and client-side validations.
 *
 *
 *** Example
 *
 * A typical set of validations:
 *
 *   Validates.Presence("login", "email", "password", "password_confirmation");
 *   Validates.Length("login", { maximum: 100 });
 *   Validates.Format("email", { "with": /^([^@\s]+)@((?:[-a-z0-9]+\.)+[a-z]{2,})$/i, allowBlank: true });
 *   Validates.Length("email", { within: [6, 100] });
 *   Validates.Ajax("email", { "if": Validate.Local });
 *   Validates.Confirmation("password", { allowBlank: true });
 *   Validates.Length("password", { within: [6, 40] });
 *
 *
 *** Extension
 *
 * NOTE: To customize the appearance of validations, see Validates.Base.Effect.
 *
 * The formula for a new Validates function is quite simple. An example:
 *
 *   Validates.Capitalized = function () {
 *       var v = new GoodForm.Validation(arguments);
 *       v.validate = function (value) {
 *           if (value[0] != value[0].toUpperCase())
 *               return v.message || "must be capitalized";
 *       }
 *   }
 *
 * Now, we can validate a form element:
 *
 *   Validates.Capitalized("name");
 */
var GoodForm = {
    /*
     * References all local validations defined on a page, by name.
     *
     *   Validates.Acceptance("privacy_policy");
     *   GoodForm.local.privacy_policy; // [Validation object]
     *
     * A Validation created for more than one item will typically only create a
     * single validation object, which will be referenced by more than one
     * node.
     *
     *   Validates.Presence("login", "email");
     *   GoodForm.local["login"][0] == GoodForm.local["email"][0]; // true
     */
    local: {},

    /*
     * References all remote validations defined on a page, by name.
     */
    remote: {},

    /*
     * Stores the default error messages at various nodes. Add to or modify the
     * object for global changes.
     */
    defaultErrorMessages: {
        inclusion: "is not included in the list",
        exclusion: "is reserved",
        invalid: "is invalid",
        confirmation: "doesn't match",
        accepted: "must be accepted",
        empty: "can't be empty",
        blank: "can't be blank",
        tooLong: "is too long (maximum is %d characters)",
        tooShort: "is too short (minimum is %d characters)",
        wrongLength: "is the wrong length (should be %d characters)",
        taken: "has already been taken",
        notANumber: "is not a number",
        greaterThan: "must be greater than %d",
        greaterThanOrEqualTo: "must be greater than or equal to %d",
        equalTo: "must be equal to %d",
        lessThan: "must be less than %d",
        lessThanOrEqualTo: "must be less than or equal to %d",
        odd: "must be odd",
        even: "must be even"
    },

    /*
     * Specifies a default message to display for valid items.
     */
    validMessage: "",

    /*
     * GoodForm.validMessages nodes can be overridden for any form element
     * name.
     *
     *   Validate("login"); // null
     *   GoodForm.validMessages["login"] = "That's a nice name!"
     *   Validate("login"); // "That's a nice name!"
     */
    validMessages: {},

    /*
     * Specifies a path to handle Ajax validations (default: "/validate").
     */
    remotePath: "/validate",

    /*
     * Between the request and response of the Ajax cycle, the span that shows
     * the validation message is given the className "loading"; it can also be
     * given content by assigning a string to GoodForm.loadingMessage.
     */
    loadingMessage: "",

    /*
     * The Validation object. Will work given a custom validation() function
     * defined to return an error message or null.
     *
     *   var v = new GoodForm.Validation(["field"]);
     *   v.validate = function () { return "is always invalid" };
     *   Validate("field"); // false
     *   GoodForm.Validate.response["field"]; // ["is always invalid"];
     */
    Validation: function (args, defaultMessage, remote) {
        args = [].splice.call(args, 0); // Convert Arguments objects
        var options = GoodForm.Helpers.extractOptions(args);

        // Apply options to Validation object
        for (var name in options) this[name] = options[name];

        // Handle error message override
        if (defaultMessage && this.message == undefined)
            this.message = GoodForm.defaultErrorMessages[defaultMessage];

        var type = remote ? "remote" : "local";
        // Register validation
        for (var i = 0; name = args[i]; ++i) {
            name = GoodForm.Helpers.extractName(name);
            if (!GoodForm[type][name]) GoodForm[type][name] = [];
            GoodForm[type][name].push(this);
        }
    },

    /*
     * GoodForm.Validates is the preferred namespace for named validations.
     */
    Validates: {
        /*
         * Encapsulates the pattern of wanting to validate the acceptance of a
         * terms of service check box (or similar agreement). Example:
         *
         *   Validates.Acceptance("terms_of_service");
         *   Validates.Acceptance("eula", { message: "must be abided" });
         *
         * Configuration options:
         *
         * - +message+ - A custom error message (default is: "must be
         *   accepted")
         * - +allowNull+ - Skip validation if attribute is null (default is
         *   true).
         * - +accept+ - Specifies value that is considered accepted. The
         *   default
         *   value is a string "1", which makes it easy to relate to an HTML
         *   checkbox.
         */
        Acceptance: function () {
            var v = new GoodForm.Validation(arguments, "accepted");
            if (!v.accept) v.accept = "1";
            v.validate = function (value) {
                if (value != v.accept)
                    return v.message;
            }
        },

        /*
         * Encapsulates the pattern of wanting to validate a password or email
         * address field with a confirmation. Example:
         *
         *   Fields:
         *     <input id="email" name="email" type="text"/>
         *     <input id="email_confirmation" name="email_confirmation" type="text"/>
         *     <input id="password" name="password" type="password"/>
         *     <input id="password_confirmation" name="password_confirmation" type="password"/>
         *
         *   JavaScript:
         *     Validates.Confirmation("email");
         *     Validates.Confirmation("password", { message: "should match password" });
         *
         * NOTE: This check is performed only if the confirmation is not null.
         * To require confirmation, make sure to add a presence check for
         * confirmation attributes:
         *
         *   Validates.Presence("email_confirmation", "password_confirmation");
         *
         * Configuration options:
         *
         * - +message+ - A custom error message (default is: "doesn't match")
         *
         * ALSO NOTE: This validation differs from its Active Record
         * counterpart. Where Active Record validates the password against the
         * confirmation, GoodForm validates the confirmation against the
         * password:
         *
         *   Validates.Confirmation("password");
         *   document.getElementById("password_confirmation").value = "differ";
         *   Validate.All();
         *   Errors["password"]; // null (returns "doesn't match confirmation" in Active Record)
         *   Errors["password_confirmation"]; // ["doesn't match"]
         */
        Confirmation: function () { // TODO: Let's try to clean this up.
            args = [].splice.call(arguments, 0); // Convert Arguments objects
            var options = GoodForm.Helpers.extractOptions(args);

            for (var i = 0; arg = args[i]; ++i) {
                arg = GoodForm.Helpers.extractName(arg);
                var orig = document.getElementsByName(arg)[0];
                var conf = document.getElementById(orig.id + "_confirmation");
                var v = new GoodForm.Validation([conf.name, options], "confirmation");
                v.orig = orig, v.conf = conf;
                v.validate = function (value) {
                    if (value != v.orig.value)
                        return v.message;
                }
            }
        },

        /*
         * Validates that the value of the specified attribute is not in a
         * particular array.
         *
         *   Validates.Exclusion("username", { "in": ["admin", "superuser"], message: "You don't belong here" });
         *   Validates.Exclusion("format", { "in": ["mov", "avi"], message => "extension %s is not allowed" });
         *
         * Configuration options:
         *
         * - +"in"+, or +inOption+ - An array of items that the value shouldn't
         *   be a part of.
         * - +message+ - Specifies a custom error message (default is: "is
         *   reserved")
         * - +allowNull+ - If set to true, skips this validation if the
         *   attribute is null (default is: false)
         * - +allowBlank+ - If set to true, skips this validation if the
         *   attribute is blank (default is: false)
         */
        Exclusion: function () {
            var v = new GoodForm.Validation(arguments, "exclusion");
            v.validate = function (value) {
                for (var i = 0, len = v["in"].length; i < len; ++i)
                    if (value == v["in"][i])
                        return v.message.replace(/%s/g, value);
            }
        },

        /*
         * Validates whether the value of the specified attribute is of the
         * correct form by matching it against the regular expression provided.
         *
         *   Validates.Format("email", { withOption: /^([^@\s]+)@((?:[-a-z0-9]+\.)+[a-z]{2,})$/i });
         *
         * A regular expression must be provided or else an exception will be
         * raised.
         *
         * Configuration options:
         *
         * - +message+ A custom error message (default is: "is invalid")
         * - +allowNull+ - If set to true, skips this validation if the
         *   attribute is null (default is: false)
         * - +allowBlank+ - If set to true, skips this validation if the
         *   attributeis blank (default is: false)
         * - +"with"+, or +withOption+ - The regular expression used to
         *   validate the format with (note: must be supplied!)
         */
        Format: function () {
            var v = new GoodForm.Validation(arguments, "invalid");
            v.validate = function (value) {
                if (!v["with"].test(value))
                    return v.message;
            }
        },

        /*
         * Validates whether the value of the specified attribute is available
         * in a particular array.
         *
         *   Validates.Inclusion("gender", { inOption: ["m", "f"], message: "woah! what are you then!??!!" });
         *   Validates.Inclusion("format", { inOption: ["jpg", "gif", "png"], message: "extension %s is not included in the list" });
         *
         * Configuration options:
         *
         * - +"in"+, or +inOption+ - An array of available items
         * - +message+ - Specifies a custom error message (default is: "is not
         *   included in the list")
         * - +allowNull+ - If set to true, skips this validation if the
         *   attribute is null (default is: false)
         * - +allowBlank+ - If set to true, skips this validation if the
         *   attribute is blank (default is: false)
         */
        Inclusion: function () {
            var v = new GoodForm.Validation(arguments, "inclusion");
            if (v.inOption) v["in"] = v.inOption;
            v.validate = function (value) {
                for (var i = 0, len = v["in"].length; i < len; ++i)
                    if (value == v["in"][i])
                        return;
                return v.message.replace(/%s/g, value);
            }
        },

        /*
         * Validates that the specified attribute matches the length
         * restrictions supplied. Only one option can be used at a time:
         *
         *   Validates.Length("first_name", { maximum: 30 });
         *   Validates.Length("last_name", { maximum: 30, message: "less than %d if you don't mind" });
         *   Validates.Length("fax", { inOption: [7, 32], allowNull: true });
         *   Validates.Length("phone", { inOption: [7, 32], allowBlank: true });
         *   Validates.Length("user_name", { within: [6, 20], tooLong: "pick a shorter name", tooShort: "pick a longer name" });
         *   Validates.Length("fav_bra_size", { minimum: 1, tooShort: "please enter at least %d character" });
         *   Validates.Length("smurf_leader", { is: 4, message: "papa is spelled with %d characters... don't play me." });
         *
         * Configuration options:
         *
         * - +minimum+ - The minimum size of the attribute
         * - +maximum+ - The maximum size of the attribute
         * - +is+ - The exact size of the attribute
         * - +within+ - An array specifying the minimum and maximum size of the
         *   attribute
         * - +"in"+, or +inOption+ - Synonyms (aliases) for +within+
         * - +allowNull+ - Attribute may be null; skip validation.
         * - +allowBlank+ - Attribute may be blank; skip validation.
         * - +tooLong+ - The error message if the attribute goes over the
         *   maximum (default is: "is too long (maximum is %d characters)")
         * - +tooShort+ - The error message if the attribute goes under the
         *   minimum (default is: "is too short (min is %d characters)")
         * - +wrongLength+ - The error message if using the +is+ method and the
         *   attribute is the wrong size (default is: "is the wrong length
         *   (should be %d characters)")
         * - +message+ - The error message to use for a +minimum+, +maximum+,
         *   or +is+ violation. An alias of the appropriate
         *   too_long/too_short/wrong_length message
         *
         * This method is also aliased as Validates.Size()
         */
        Length: function () {
            var v = new GoodForm.Validation(arguments);
            if (v.inOption) v["in"] = v.inOption;
            if (range = v.within || v["in"])
                v.minimum = range[0], v.maximum = range[range.length - 1];
            else if (v.is)
                v.minimum = v.maximum = v.is;
            v.validate = function (value) {
                var len = value ? value.length : 0;
                if (v.minimum == v.maximum && len != v.minimum)
                    return (v.wrongLength || v.message
                        || GoodForm.defaultErrorMessages.wrongLength).replace(/%d/g, v.minimum)
                if (len < v.minimum)
                    return (v.tooShort || v.message
                        || GoodForm.defaultErrorMessages.tooShort).replace(/%d/g, v.minimum)
                if (v.maximum && len > v.maximum)
                    return (v.tooLong || v.message
                        || GoodForm.defaultErrorMessages.tooLong).replace(/%d/g, v.maximum)
            }
        },

        /*
         * Validates whether the value of the specified attribute is numeric by
         * trying to convert it to a float with Math.parseFloat (if onlyInteger
         * is false) or applying it to the regular expression /^[+\-]?\d+$/ (if
         * onlyInteger is set to true).
         *
         *   Validates.Numericality("value");
         *
         * Configuration options:
         *
         * - +message+ - A custom error message (default is: "is not a number")
         * - +onlyInteger+ - Specifies whether the value has to be an integer,
         *   e.g. an integral value (default is false)
         * - +allowNull+ - Skip validation if attribute is null (default is
         *   false).
         * - +greaterThan+ - Specifies the value must be greater than the
         *   supplied value
         * - +greaterThanOrEqualTo+ - Specifies the value must be greater than
         *   or equal the supplied value
         * - +equalTo+ - Specifies the value must be equal to the supplied
         *   value
         * - +lessThan+ - Specifies the value must be less than the supplied
         *   value
         * - +lessThanOrEqualTo+ - Specifies the value must be less than or
         *   equal the supplied value
         * - +odd+ - Specifies the value must be an odd number
         * - +even+ - Specifies the value must be an even number
         */
        Numericality: function () {
            var v = new GoodForm.Validation(arguments);
            v.validate = function (value) {
                if (v.onlyInteger && !/^[+\-]?\d+$/.test(value) || value != parseFloat(value))
                    return v.message || GoodForm.defaultErrorMessages.notANumber;
                if (v.greaterThan && value <= v.greaterThan)
                    return v.message
                        || GoodForm.defaultErrorMessages.greaterThan.replace(/%d/g, v.greaterThan);
                if (v.greaterThanOrEqualTo && value < v.greaterThanOrEqualTo)
                    return v.message
                        || GoodForm.defaultErrorMessages.greaterThanOrEqualTo.replace(/%d/g, v.greaterThanOrEqualTo);
                if (v.equalTo && value != v.equalTo)
                    return v.message
                        || GoodForm.defaultErrorMessages.equalTo.replace(/%d/g, v.equalTo);
                if (v.lessThan && value >= v.lessThan)
                    return v.message
                        || GoodForm.defaultErrorMessages.lessThan.replace(/%d/g, v.lessThan);
                if (v.lessThanOrEqualTo && value > v.lessThanOrEqualTo)
                    return v.message
                        || GoodForm.defaultErrorMessages.lessThanOrEqualTo.replace(/%d/g, v.lessThanOrEqualTo);
                if (v.odd && value % 2 != 1)
                    return v.message || GoodForm.defaultErrorMessages.odd;
                if (v.even && value % 2 != 0)
                    return v.message || GoodForm.defaultErrorMessages.even;
            }
        },

        /*
         * Validates that the specified attributes are not blank (as realized
         * by /^\s*$/.test(value). Example:
         *
         *   Validates.Presence("first_name");
         *
         * The first_name attribute cannot be blank.
         *
         * Configuration options:
         *
         * - +message+ - A custom error message (default is: "can't be blank")
         */
        Presence: function () {
            var v = new GoodForm.Validation(arguments, "blank");
            v.validate = function (value) {
                if (/^\s*$/.test(value || ""))
                    return v.message;
            }
        },

        /*
         * Handles validation with Ajax should the server be consulted for
         * validity.
         *
         * E.g., if email addresses must be unique:
         *
         *   Validates.Ajax("email");
         *
         * When the item is validated, a "GET" request is sent to the path
         * specified by Validates.Base.AjaxPath, with the item's attributes 
         * serialized in a query string. The server should respond with a JSON
         * string of name-value pairs reflecting the name attribute of the item
         * validated, and the status of the validation. Invalid items should
         * return an array of error messages. Valid items should return null,
         * or a custom string stating validity:
         *
         *   { email: ["is invalid"] } // Invalid
         *   { email: null }           // Valid
         *   { email: "OK" }           // Valid with message
         *
         * Configuration options:
         *
         * - +include+ - one or more elements, element names, or parameters in
         *   the form of "name=value".
         */
        Ajax: function () {
            var v = new GoodForm.Validation(arguments, null, true);
            v.include = [].concat(v.include);
            v.pushParameters = function () {
                for (var i = 0; incl = v.include[i]; ++i) {
                    if (value = GoodForm.Helpers.getValuesByName(incl))
                        GoodForm.Validate.queue[incl] = value;
                    else if (pair = incl.split("="))
                        GoodForm.Validate.queue[pair[0]] = pair[1];
                }
            }
        },

        /*
         *   Validates.AdHoc("number", { "with": function (value) { return value == 1; }, message: "ones only" });
         */
        AdHoc: function () {
            var v = new GoodForm.Validation(arguments);
            v.validate = function (value) {
                if (!v["with"](value))
                    return v.message || "invalid";
            }
        }
    },

    Validate: {
        /*
         * The queue manages the remote validation process: whenever Validate()
         * is called, remote validations are moved to the queue. The queue is
         * cleared when Validate.Run() is called.
         */
        queue: {},

        /*
         * Keeps track of validation responses over the course of a validation.
         * Both local and remote reponses are stored here.
         */
        response: {},

        /*
         * Validates a form item by name.
         *
         *   Validate("login");
         *
         * Configuration options:
         *
         * - +defer+ - Hold validation response in the queue.
         * - +local+ - Only run local validations.
         * - +scope+ - Only run under the scope of a single form.
         */
        Name: function (name, options) {
            name = GoodForm.Helpers.extractName(name);
            options = GoodForm.Helpers.extractOptions(options);
            if (!options.defer) GoodForm.Validate.response = {}; // Initialize

            var value = GoodForm.Helpers.getValuesByName(name, options.scope);
            if (value == undefined) return;

            if (!options.local)
                var remote = GoodForm.Validate.Queue("remote", name, value);
            if (!remote)
                GoodForm.Validate.Queue("local", name, value);

            if (!options.defer)
                return GoodForm.Validate.Run({ silent: options.silent });
            if (name)
                return GoodForm.Validate.response[name];
        },

        /*
         * Queues up validations. Remote validations goto Validate.queue till
         * the Ajax response. All validations end up in Validate.response.
         */
        Queue: function (type, name, value) {
            if (!GoodForm[type][name]) return null;
            for (var i = 0, len = GoodForm[type][name].length; i < len; ++i) {
                var v = GoodForm[type][name][i];
                switch (true) {
                    case (v.allowBlank && /^\s*$/.test(value)):
                    case (v.allowNull && value == ""):
                    case (v["if"] && !v["if"](name)):
                    case (v.unless && v.unless(name)):
                        break;
                    default:
                        if (type == "remote") {
                            GoodForm.Validate.queue[name] = value;
                            v.pushParameters();
                        } else if (error = v.validate(value)) {
                            var errors = GoodForm.Validate.response[name] || [];
                            GoodForm.Validate.response[name] = errors.concat(error);
                        }
                }
            }
            if (type == "remote")
                return GoodForm.Validate.queue[name];
            else if (!GoodForm.Validate.response[name])
                GoodForm.Validate.response[name] = GoodForm.validMessages[name]
                                                || GoodForm.validMessage;
            return GoodForm.Validate.response[name];
        },

        /*
         * Runs every validation on the page (can be scoped with one argument
         * to a specific form).
         */
        All: function (form) {
            GoodForm.Validate.response = {};

            for (var name in GoodForm.remote)
                GoodForm.Validate.Name(name, { defer: true, scope: form });

            for (var name in GoodForm.local)
                if (!GoodForm.Validate.response[name])
                    GoodForm.Validate.Name(name, { defer: true, scope: form });

            return GoodForm.Validate.Run();
        },

        /*
         * Runs a local validation silently. Returns true if valid, false if not.
         */
        Local: function (name) {
            for (var i = 0; v = GoodForm.local[name][i]; ++i)
                if (v.validate(GoodForm.Helpers.getValuesByName(name)))
                    return false;
            return true;
        },

        /*
         * Runs an ajax validation with the values populated in the queue.
         */
        Remote: function () {
            var params = [];
            for (var name in GoodForm.Validate.queue) {
                var values = [].concat(GoodForm.Validate.queue[name]);
                for (var i = 0; value = values[i]; ++i)
                    params.push(name + "=" + encodeURIComponent(value));
            }

            if (params.length < 1) return false;

            var t, loadingState;
            try { t = new XMLHttpRequest(); } catch(e) {
            try { t = new ActiveXObject('Msxml2.XMLHTTP'); } catch(e)
                { t = new ActiveXObject('Microsoft.XMLHTTP'); }};

            t.onreadystatechange = function () {
                if (t.readyState == 4 && t.status >= 200 && t.status < 300) {
                    eval("var json = " + t.responseText);
                    for (var name in json)
                        new GoodForm.Validate.Effect(name, json[name]);
                } else if (!loadingState)
                    for (var name in GoodForm.Validate.queue)
                        new GoodForm.Validate.Effect(name); // No response: loading.
            }

            var baseUri = location.protocol + "//" + location.host + GoodForm.remotePath;
            t.open("GET", baseUri + "?" + params.join("&"));
            t.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
            t.send(null);
            return true;
        },

        /*
         * A GoodForm.Validate.Effect object is created whenever validation is
         * run.
         *
         * By default, it looks for an element matching the form element's
         * name, plus "_validation". E.g., for "phone_number" it would look for
         * "phone_number_validation". If this element isn't found, it creates
         * a span and inserts it into the DOM directly after the form element.
         *
         * Names are passed through GoodForm.Helpers.underscore to keep the DOM
         * valid: "user[email]" becomes, therefore, "user_email_validation".
         *
         * Upon validation, this element is given a className of "valid",
         * "error", or, during the loading phase of an Ajax request, "loading".
         *
         * Override this function to customize visual validation. It accepts
         * two arguments:
         *
         *   - +name+ - The validated form item name.
         *   - +response+ - The validation response. Invalid objects return an
         *     array of error messages; valid objects return null or a preset
         *     valid string.
         */
        Effect: function (name, response) {
            if (el = GoodForm.Helpers.findOrCreateValidationSpan(name)) {
                var status = GoodForm.Helpers.parseResponse(response);
                el.className = "good_form " + status;
                switch (status) {
                    case ("loading"):
                        el.innerHTML = GoodForm.loadingMessage;
                        break;
                    case ("valid"):
                        el.innerHTML = response || GoodForm.validMessages[name] || GoodForm.validMessage;
                        break;
                    case ("error"):
                        el.innerHTML = response.join(", ");
                        break;
                }
            }
        },

        /*
         * Applies queued and local validation responses.
         */
        Run: function (options) {
            var response, options = GoodForm.Helpers.extractOptions(options);
            if (GoodForm.Validate.queue && !GoodForm.Validate.Remote())
                for (var name in GoodForm.Validate.response) {
                    response = GoodForm.Validate.response[name];
                    if (!options.silent)
                        new GoodForm.Validate.Effect(name, response);
                }

            GoodForm.Validate.queue = {};
            return GoodForm.Helpers.parseResponse(response) == "valid";
        }
    },

    Helpers: {
        /*
         * Returns the last object out of an array of arguments. If no object
         * exists, a new object is returned.
         */
        extractOptions: function (input) {
            if (input) {
                if (input.constructor == Object)
                    return input;
                else if (input.constructor == Array) {
                    var last = input[input.length - 1];
                    if (last.constructor == Object)
                        return input.pop();
                }
            }
            return {};
        },

        extractName: function (input) {
            if (input.name)
                return input.name;
            else if (el = document.getElementById(input))
                return el.name;
            else
                return input;
        },

        /*
         * Returns a validation span for GoodForm.Validate.Effect, creating a
         * new one if it does not exist.
         */
        findOrCreateValidationSpan: function(name) {
            var id = GoodForm.Helpers.underscore(name) + "_validation";
            if (vEl = document.getElementById(id)) return vEl;
            vEl = document.createElement("span");
            vEl.id = id;
            var fEls = document.getElementsByName(name);
            if (fEl = fEls[fEls.length - 1]) {
                fEl.parentNode.insertBefore(vEl, fEl.nextSibling);
                return vEl;
            }
        },

        /*
         * Returns an array of values for a form item name. If only one value
         * is available, it will be returned in a string. No values will return
         * null.
         */
        getValuesByName: function (name, form) {
            var els = document.getElementsByName(name), values = [];
            if (form && form.constructor == String)
                form = document.getElementById(form);
            for (var i = 0, len = els.length; el = els[i]; ++i)
                if (!form || form == el.form)
                    if (el.checked || !/checkbox|radio/.test(el.type))
                        values.push(el.value);
                    else if (len == 1)
                        values.push(""); // For the unchecked
            return values.length > 1 ? values : values[0];
        },

        /*
         * Parses a response to see if a validation passed, failed, or is still
         * loading. Error messages come in an array. Valid messages are
         * strings. If the response is undefined, it is still loading.
         */
        parseResponse: function (response) {
            if (response == undefined)
                return "loading";
            if (response.constructor == Array && response.length > 0)
                return "error";
            else
                return "valid";
        },

        /*
         * Consolidates each set of invalid characters in a string to an
         * underscore. The string will retain alphanumerical start and end
         * points.
         *
         *   GoodForm.Helpers.underscore("user[email]"); // "user_email"
         */
        underscore: function (string) {
            return string.toLowerCase().replace(/[^\w]+/g, "_").
                                        replace(/^_+|_+$/g, "");
        }
    }
}

/*
 * Alias for Validates.Length
 */
GoodForm.Validates.Size = GoodForm.Validates.Length;

/*
 * Top-level aliases
 */
var Validates = GoodForm.Validates;
var Validate = $V = GoodForm.Validate.Name;
Validate.All = GoodForm.Validate.All;
Validate.Local = GoodForm.Validate.Local;
