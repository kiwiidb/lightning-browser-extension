import { Fragment, useState, useEffect, MouseEvent } from "react";
import axios from "axios";
import { useNavigate, useSearchParams } from "react-router-dom";

import {
  LNURLPaymentInfo,
  LNURLPaymentSuccessAction,
  LNURLPayServiceResponse,
} from "../../types";
import api from "../../common/lib/api";
import msg from "../../common/lib/msg";
import utils from "../../common/lib/utils";
import lnurl from "../../common/lib/lnurl";
import getOriginData from "../../extension/content-script/originData";
import { useAuth } from "../context/AuthContext";

import Button from "../components/Button";
import Input from "../components/Form/Input";
import PublisherCard from "../components/PublisherCard";
import bolt12 from "../../common/lib/bolt12";
import { DecodedOffer } from "../../types";

type Origin = {
  name: string;
  icon: string;
};

type Props = {
  details?: DecodedOffer;
  origin?: Origin;
};

function Offer(props: Props) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState(props.details);
  const [origin] = useState(
    props.origin ||
      (searchParams.get("origin") &&
        JSON.parse(searchParams.get("origin") as string)) ||
      getOriginData()
  );
  const [valueSat, setValueSat] = useState(
    (details?.minSendable && (+details?.minSendable / 1000).toString()) || ""
  );
  const [comment, setComment] = useState("");
  const [userName, setUserName] = useState("");
  const [loadingConfirm, setLoadingConfirm] = useState(false);
  const [successAction, setSuccessAction] = useState<
    LNURLPaymentSuccessAction | undefined
  >();

  useEffect(() => {
    if (searchParams) {
      // offer was passed as querystring
      const offerString = searchParams.get("offer");
      if (offerString) {
        bolt12.decodeOffer(offerString).then((offerDetails) => {
         setDetails(offerDetails);
         setLoading(false);
        });
      } else {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, [searchParams]);

  useEffect(() => {
    api.getSettings().then((response) => {
      if (response.userName) {
        setUserName(response.userName);
      }
    });
  }, []);

  async function confirm() {
    if (!details) return;
    const offerString = searchParams.get("offer");

    try {
      setLoadingConfirm(true);
      const payment = await utils.call(
        "offerPay",
        { offerString , valueSat, comment },
        {
          origin: {
            ...origin,
            name: getRecipient(),
          },
        }
      );

      // Once payment is fulfilled LN WALLET executes a non-null successAction
      // LN WALLET should also store successAction data on the transaction record
      if (paymentInfo.successAction && !payment.payment_error) {
        switch (paymentInfo.successAction.tag) {
          case "url":
          case "message":
            setSuccessAction(paymentInfo.successAction);
            break;
          case "aes": // TODO: For aes, LN WALLET must attempt to decrypt a ciphertext with payment preimage
          default:
            alert(
              `Not implemented yet. Please submit an issue to support success action: ${paymentInfo.successAction.tag}`
            );
            break;
        }
      } else {
        setSuccessAction({ tag: "message", message: "Success, payment sent!" });
      }

      auth.fetchAccountInfo(); // Update balance.
    } catch (e) {
      console.log(e);
      if (e instanceof Error) {
        alert(`Error: ${e.message}`);
      }
    } finally {
      setLoadingConfirm(false);
    }
  }

  function reject(e: MouseEvent) {
    e.preventDefault();
    if (props.details && props.origin) {
      msg.error("User rejected");
    } else {
      navigate(-1);
    }
  }

  function getRecipient() {
    if (!details?.node_id) return;
    return details.node_id;
  }

  function renderAmount(details: DecodedOffer) {
      return (
        <div className="mt-1 flex flex-col">
          <Input
            type="number"
            min={+0 / 1000}
            max={+1000000 / 1000}
            value={valueSat}
            onChange={(e) => setValueSat(e.target.value)}
          />
          <div className="flex space-x-1.5 mt-2">
            <Button
              fullWidth
              label="100 sat⚡"
              onClick={() => setValueSat("100")}
            />
            <Button
              fullWidth
              label="1K sat⚡"
              onClick={() => setValueSat("1000")}
            />
            <Button
              fullWidth
              label="5K sat⚡"
              onClick={() => setValueSat("5000")}
            />
            <Button
              fullWidth
              label="10K sat⚡"
              onClick={() => setValueSat("10000")}
            />
          </div>
        </div>
      );
  }

  function renderComment() {
    return (
      <div className="flex flex-col">
        <Input
          type="text"
          placeholder="optional"
          onChange={(e) => {
            setComment(e.target.value);
          }}
        />
      </div>
    );
  }

  function renderName() {
    return (
      <div className="mt-1 flex flex-col">
        <Input
          type="text"
          placeholder="optional"
          value={userName}
          onChange={(e) => {
            setUserName(e.target.value);
          }}
        />
      </div>
    );
  }

  function formattedMetadata(metadataJSON: string) {
    try {
      const metadata = JSON.parse(metadataJSON);
      return metadata
        .map(([type, content]: [string, string]) => {
          if (type === "text/plain") {
            return ["Description", content];
          } else if (type === "text/long-desc") {
            return ["Full Description", <p key={type}>{content}</p>];
          }
          return undefined;
        })
        .filter(Boolean);
    } catch (e) {
      console.error(e);
    }
    return [];
  }

  function elements() {
    if (loading || !details)
      return [
        ["Send payment to", "loading..."],
        ["Description", "loading..."],
        ["Amount (Satoshi)", "loading..."],
      ];
    const elements = [];
    elements.push(["Send payment to", getRecipient()]);
    elements.push(["Description: ", details.description]);
    elements.push([
      "Amount (Satoshi)",
      renderAmount(details),
    ]);
    if (true) {
      elements.push(["Comment", renderComment()]);
    }
    if (details?.payerData?.name) {
      elements.push(["Name", renderName()]);
    }
    return elements;
  }

  function renderSuccessAction() {
    if (!successAction) return;
    let descriptionList;
    if (successAction.tag === "url") {
      descriptionList = [
        ["Description", successAction.description],
        [
          "Url",
          <>
            {successAction.url}
            <div className="mt-4">
              <Button
                onClick={() => {
                  if (successAction.url) utils.openUrl(successAction.url);
                }}
                label="Open"
                primary
              />
            </div>
          </>,
        ],
      ];
    } else if (successAction.tag === "message") {
      descriptionList = [["Message", successAction.message]];
    }

    return (
      <>
        <dl className="shadow bg-white dark:bg-gray-700 pt-4 px-4 rounded-lg mb-6 overflow-hidden">
          {descriptionList &&
            descriptionList.map(([dt, dd], i) => (
              <Fragment key={`dl-item-${i}`}>
                <dt className="text-sm font-semibold text-gray-500">{dt}</dt>
                <dd className="text-sm mb-4 dark:text-white">{dd}</dd>
              </Fragment>
            ))}
        </dl>
        <div className="text-center">
          <button
            className="underline text-sm text-gray-500"
            onClick={() => window.close()}
          >
            Close
          </button>
        </div>
      </>
    );
  }

  return (
    <div>
      <PublisherCard
        title={origin.name}
        description={origin.description}
        image={origin.icon}
      />
      <div className="p-4 max-w-screen-sm mx-auto">
        {!successAction ? (
          <>
            <dl className="shadow bg-white dark:bg-gray-700 pt-4 px-4 rounded-lg mb-6 overflow-hidden">
              {elements().map(([t, d], i) => (
                <Fragment key={`element-${i}`}>
                  <dt className="text-sm font-semibold text-gray-500">{t}</dt>
                  <dd className="text-sm mb-4 dark:text-white">{d}</dd>
                </Fragment>
              ))}
            </dl>
            <div className="text-center">
              <div className="mb-5">
                <Button
                  onClick={confirm}
                  label="Confirm"
                  fullWidth
                  primary
                  loading={loadingConfirm}
                  disabled={loadingConfirm || !valueSat}
                />
              </div>

              <p className="mb-3 underline text-sm text-gray-300">
                Only connect with sites you trust.
              </p>

              <a
                className="underline text-sm text-gray-500"
                href="#"
                onClick={reject}
              >
                Cancel
              </a>
            </div>
          </>
        ) : (
          renderSuccessAction()
        )}
      </div>
    </div>
  );
}

export default Offer;
