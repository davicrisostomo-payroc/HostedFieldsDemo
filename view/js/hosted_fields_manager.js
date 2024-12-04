class HostedFieldsManager {
    constructor(apiClient) {
        this.apiClient = apiClient;
        this.surchargeDisclosure = null;
        this.surchargeLineItem = null;
        this.totalLineItem = null;
        this.form = null;
    }

    async initialize(scenario, fields, method, terminalId, currency, amount) {
        this._cacheSurchargeElements();

        const sessionRequest = await this.apiClient.initSession(scenario, terminalId);

        if (sessionRequest.status && sessionRequest.status !== '200') {
            throw new Error(sessionRequest.errors[0].message);
        }

        this.form = new Payroc.hostedFields({
            sessionToken: sessionRequest['token'],
            mode: scenario,
            fields: fields,
            onPreSubmit: () => this.validateCustomerDetails(),
        });

        this._setupFormEventHandlers(scenario, method, terminalId, currency, amount);

        await this.form.initialize();
    }

    _cacheSurchargeElements() {
        this.surchargeDisclosure = document.getElementById("surcharge-disclosure");
        this.surchargeLineItem = document.getElementById("surcharge-line-item");
        this.totalLineItem = document.getElementById("total-line-item");
    }

    _setupFormEventHandlers(scenario, method, terminalId, currency, amount) {
        this.form.on("surchargingAllowed", ({ percentage, disclosure }) => {
            if (this._surchargeDivsArePresent()) this._addSurchargeFee(amount, percentage, disclosure);
        });

        this.form.on("surchargingNotAllowed", () => {
            if (this._surchargeDivsArePresent()) this._removeSurchargeFee(amount);
        });

        this.form.on("submissionSuccess", async ({ token, expiresAt }) => {
            const customer = this._getCustomerObject();
            const response = scenario === "payment"
                ? await this.apiClient.createPayment(method, terminalId, customer, currency, amount, token)
                : await this.apiClient.createSecureToken(terminalId, customer, token);


            document.querySelector('.customer-details').style.display = "none";
            document.querySelector(".pyrc-hosted-fields").style.display = "none";
            this._renderJSONResponse(response);
        });

        this.form.on("error", async ({ message }) => {
            const container = document.getElementById("display-error");
            container.innerHTML = message + `<p><button onClick="window.location.reload();" style="margim-top:15px;">Refresh Page</button>`;
            document.querySelector('.customer-details').style.display = "none";
            document.querySelector(".pyrc-hosted-fields").style.display = "none";
        });
    }

    _renderJSONResponse(json) {
        const container = document.getElementById("display-result");
        const jsonString = JSON.stringify(json, null, 2); // Pretty format JSON
        const lines = jsonString.split("\n"); // Split into lines

        lines.forEach(line => {
            const tokenLineDiv = document.createElement("div");
            tokenLineDiv.className = "token-line";

            // Regex patterns for different JSON components
            const patterns = [
                { regex: /^(\s+)/, className: "token plain" }, // Indentation
                { regex: /"([^"]+)"(?=:)/g, className: "token string-property key" }, // Keys/Strings
                { regex: /:/, className: "token operator" }, // Colon
                { regex: /[\{\[]/g, className: "token object-open" },
                { regex: /(?<=:)\s*[^\,\{\]\}\[]+/g, className: "token string-property value" }, // value/Strings
                { regex: /[\}\]]/g, className: "token object-close" },
                { regex: /[,]/g, className: "token punctuation" },
            ];

            // Iterate through each pattern and process the line
            let processedLine = ``;
            patterns.forEach(({ regex, className }) => {
                line.replace(regex, match => {
                    let currentClassName = className; // Create a copy of className to modify
                    if (currentClassName === 'token string-property value') {
                        if (!match.trim()) {
                            currentClassName = "token plain";
                        } else if (!match.trim().startsWith('"')) {
                            currentClassName = "token bool-property value";
                        }
                    }
                    processedLine += `<span class="${currentClassName}">${match}</span>`;
                });
            });
            tokenLineDiv.innerHTML = processedLine; // Set the processed line as HTML
            container.appendChild(tokenLineDiv);
        });
    }


    _surchargeDivsArePresent() {
        return this.surchargeDisclosure && this.surchargeLineItem && this.totalLineItem;
    }

    _addSurchargeFee(amount, percentage, disclosure) {
        const surchargeAmount = Math.ceil(amount * (percentage / 100));
        const total = amount + surchargeAmount;

        this.surchargeDisclosure.innerText = disclosure;
        this.surchargeDisclosure.style.display = "block";

        this.surchargeLineItem.lastElementChild.innerText = `$${(surchargeAmount / 100).toFixed(2)}`;
        this.surchargeLineItem.style.display = "flex";

        this.totalLineItem.lastElementChild.innerText = `$${(total / 100).toFixed(2)}`;
        this.totalLineItem.style.display = "flex";
    }

    _removeSurchargeFee(amount) {
        this.totalLineItem.lastElementChild.innerText = `$${(amount / 100).toFixed(2)}`;
        this.surchargeLineItem.style.display = "none";
        this.surchargeDisclosure.style.display = "none";
    }

    async validateCustomerDetails() {
        const customerDetails = document.querySelector(".customer-details");
        if (!customerDetails) return false;

        let validation = true;
        const requiredFields = customerDetails.querySelectorAll("input[required]");
        for (const field of requiredFields) {
            if (!field.value.trim()) {
                displayMissingFieldsError(field.id);
                validation = false;
            }
        }
        return validation;
    }

    _getCustomerObject() {
        let data = {};
        const billingAddress = this._getCustomFieldValues();
        const contactMethods = this._getContactMethods();
        if (Object.keys(billingAddress).length > 0) data['billingAddress'] = billingAddress;
        if (Object.keys(contactMethods).length > 0) data['contactMethods'] = contactMethods;
        return data;
    }

    _getCustomFieldValues() {
        const fields = document.querySelectorAll(".billing-details input, .billing-details select");
        const values = {};

        fields.forEach(field => {
            const value = field.value;
            if (value) values[field.id] = value.trim();
        });

        return values;
    }

    _getContactMethods() {
        const contactMethods = [];
        document.querySelectorAll(".contact-methods  input").forEach(field => {
            const value = field.value;
            if (value) {
                contactMethods.push({ type: field.id, value: value.trim() });
            }
        });
        return contactMethods;
    }
}
