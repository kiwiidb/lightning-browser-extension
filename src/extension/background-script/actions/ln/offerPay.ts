import PubSub from "pubsub-js";
import { parsePaymentRequest } from "invoices";

import { Message } from "../../../../types";
import state from "../../state";
import utils from "../../../../common/lib/utils";

export default async function offerPay(message: Message) {
  PubSub.publish(`ln.offerPay.start`, message);
  const { offerString, valueSat, comment } = message.args;

  const connector = await state.getState().getConnector();

  console.log(offerString);
  const response = await connector.sendPaymentOffer({
    offer: offerString,
    amt: valueSat,
    memo: comment
  });
  utils.publishPaymentNotification(message, "", response);
  return response;
}
