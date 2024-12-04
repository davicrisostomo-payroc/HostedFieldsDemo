/**
 * This class provides functions to interact with the Payroc API.
 * These functions should reside on the client server in production
 * as they handle sensitive data like the x-api-key and bearer token.
 */
class ApiClient {

    constructor(xApiKey) {
        this.baseUrl = 'https://api.uat.payroc.com/v1';
        this.xApiKey = xApiKey;
        this.bearerToken = null;
        this.expirationTime = null; // Timestamp for when the token expires
        this.setBearerToken();
    }

    async initSession(scenario, terminalId) {
        const endpoint = `${this.baseUrl}/processing-terminals/${terminalId}/hosted-fields-sessions`;
        const data = { libVersion: "1.2.0-beta.135020", scenario: scenario };
        const response = await this.forwardRequest(endpoint, 'POST', data);
        return response;
    }

    async createPayment(paymentMethod, terminalId, amount, currency, singleUseToken) {
        const endpoint = `${this.baseUrl}/${("card" == paymentMethod) ? "payments" : "bank-transfer-payments"}`;
        const orderId = `hfdp_${Date.now()}`;
        const data = {
            channel: web,
            processingTerminalId: terminalId,
            order: {
                orderId: orderId,
                amount: amount,
                currency: currency
            },
            paymentMethod: {
                type: 'singleUseToken',
                token: singleUseToken
            }
        }
        return await this.forwardRequest(endpoint, 'POST', data);
    }

    async createSecureToken(terminalId, singleUseToken) {
        const endpoint = `${this.baseUrl}/processing-terminals/${terminalId}/secure-tokens`;
        const data = {
            channel: web,
            mitAgreement: unscheduled,
            source: {
                type: 'singleUseToken',
                token: singleUseToken
            }
        };
        return await this.forwardRequest(endpoint, 'POST', data);
    }

    async forwardRequest(endpoint, method, data = null) {
        try {
            const bearer = await this.getBearerToken();
            const IdempotencyKey = this.getUUIDv4();
            const options = {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Idempotency-Key': IdempotencyKey,
                    Authorization: `Bearer ${bearer}`
                },
                body: data ? JSON.stringify(data) : null,
            };

            const response = await fetch(endpoint, options);
            if (!response.ok) {
                throw new Error(`API error: ${response.status} ${response.statusText}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Request failed:', error);
            throw error;
        }
    }

    async getBearerToken() {
        if (!this.bearerToken || Date.now() >= this.expirationTime) {
            console.log('Token expired or not set. Fetching a new token...');
            await this.setBearerToken();
        } else {
            console.log('Token is still valid.');
        }
        return this.bearerToken;
    }

    async setBearerToken() {
        const options = {
            method: 'POST',
            headers: { 'x-api-key': this.xApiKey, }
        };

        try {
            const response = await fetch('https://identity.uat.payroc.com/authorize', options);
            const responseJson = await response.json();

            if (!response.ok) {
                throw new Error(`API error: ${response.status} ${response.statusText}`);
            }

            this.bearerToken = responseJson['access_token'];
            const expiresIn = responseJson['expires_in'];
            this.expirationTime = Date.now() + expiresIn * 1000; // Store expiration time in milliseconds
        } catch (err) {
            console.error('Request failed:', err);
            throw err;
        }
    }

    getUUIDv4() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
}

window.ApiClient = ApiClient;