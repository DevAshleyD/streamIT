// A reference to Stripe.js
let stripe;

let orderData = {
  // items: [{id: 'photo-subscription'}],
  currency: 'twd',
};

const number = document.getElementById('number');
const stripeMsg = document.getElementById('stripeMsg');

fetch('/payment/stripe-key')
    .then(function(result) {
      return result.json();
    })
    .then(function(data) {
      return setupElements(data);
    })
    .then(function({stripe, card, clientSecret}) {
      document.querySelector('button').disabled = false;

      const form = document.getElementById('payment-form');
      form.addEventListener('submit', function(event) {
        event.preventDefault();
        if (!giver.value || !receiver.value || !number.value || !stripeMsg.value) {
          Swal.fire({
            title: 'Please fill in the blanks!',
            icon: 'warning',
            confirmButtonColor: '#000',
          });
        } else {
          pay(stripe, card, clientSecret);
        }
      });
    });

const setupElements = function(data) {
  stripe = Stripe(data.publishableKey);
  /* ------- Set up Stripe Elements to use in checkout form ------- */
  const elements = stripe.elements();
  const style = {
    base: {
      'color': '#32325d',
      'fontFamily': 'Helvetica Neue, Helvetica, sans-serif',
      'fontSmoothing': 'antialiased',
      'fontSize': '16px',
      '::placeholder': {
        color: '#aab7c4',
      },
    },
    invalid: {
      color: '#fa755a',
      iconColor: '#fa755a',
    },
  };

  const card = elements.create('card', {style: style});
  card.mount('#card-element');

  return {
    stripe: stripe,
    card: card,
    clientSecret: data.clientSecret,
  };
};

const handleAction = function(clientSecret) {
  stripe.handleCardAction(clientSecret).then(function(data) {
    if (data.error) {
      showError('Your card was not authenticated, please try again');
    } else if (data.paymentIntent.status === 'requires_confirmation') {
      fetch('/payment/pay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentIntentId: data.paymentIntent.id,
        }),
      })
          .then(function(result) {
            return result.json();
          })
          .then(function(json) {
            if (json.error) {
              showError(json.error);
            } else {
              orderComplete(clientSecret);
            }
          });
    }
  });
};

/*
 * Collect card details and pay for the order
 */
const pay = function(stripe, card) {
  changeLoadingState(true);

  // Collects card details and creates a PaymentMethod
  stripe
      .createPaymentMethod('card', card)
      .then(function(result) {
        if (result.error) {
          showError(result.error.message);
        } else {
          orderData.paymentMethodId = result.paymentMethod.id;
          orderData.amount = document.querySelector('.inputNumber').value;

          return fetch('/payment/pay', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(orderData),
          });
        }
      })
      .then(function(result) {
        return result.json();
      })
      .then(function(response) {
        if (response.error) {
          showError(response.error);
        } else if (response.requiresAction) {
          // Request authentication
          handleAction(response.clientSecret);
        } else {
          orderComplete(response.clientSecret);
        }
      });
};

/* ------- Post-payment helpers ------- */

/* Shows a success / error message when the payment is complete */
const orderComplete = function(clientSecret) {
  stripe.retrievePaymentIntent(clientSecret).then(function(result) {
    const paymentIntent = result.paymentIntent;
    // const paymentIntentJson = JSON.stringify(paymentIntent, null, 2);

    if (paymentIntent.status === 'succeeded') {
      const amount = document.querySelector('.inputNumber').value;
      let fromId;
      let fromName;
      if (localStorage.getItem('userInfo') !== null) {
        fromId = JSON.parse(localStorage.getItem('userInfo')).id 
        fromName = JSON.parse(localStorage.getItem('userInfo')).name;
      } else {
        fromId = null;
        fromName = document.getElementById('giver').value;;
      }
      const toId = streamerId;
      const toName = document.querySelector('.streamerName').innerText;
      const message = document.getElementById('stripeMsg').value;

      const data = {
        fromId: fromId,
        fromName: fromName,
        toId: toId,
        toName: toName,
        amount: amount,
        message: message,
      };

      fetch('/payment/pay', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      Swal.fire({
        title: 'Donate Successful!\n You donated NTD. ' + (paymentIntent.amount/100) + '!',
        icon: 'success',
        confirmButtonColor: '#000',
      }).then(() => {
        changeLoadingState(false);
        donateForm.style.display = 'none';
      });
    }
  });
};

const showError = function(errorMsgText) {
  changeLoadingState(false);
  Swal.fire({
    title: errorMsgText,
    icon: 'error',
    confirmButtonColor: '#000',
  });
};

// Show a spinner on payment submission
const changeLoadingState = function(isLoading) {
  console.log('CurrentState: ', isLoading)
  if (isLoading) {
    document.querySelector('.stripeBtn').disabled = true;
    document.querySelector('#spinner').classList.remove('hide');
    document.querySelector('#button-text').classList.add('hide');
  } else {
    document.querySelector('.stripeBtn').disabled = false;
    document.querySelector('#spinner').classList.add('hide');
    document.querySelector('#button-text').classList.remove('hide');
  }
};

