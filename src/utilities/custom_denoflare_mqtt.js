// This is a custom build of the denoflare-mqtt project with support
// for UNSUBSCRIBE, for sending a clean flag when connecting, and
// better use of promise return values in general.

// bytes.ts
var _Bytes = class _Bytes {
	constructor(bytes) {
	  this._bytes = bytes;
	  this.length = bytes.length;
	}
	array() {
	  return this._bytes;
	}
	async sha1() {
	  const hash = await cryptoSubtle().digest("SHA-1", this._bytes);
	  return new _Bytes(new Uint8Array(hash));
	}
	concat(other) {
	  const rt = new Uint8Array(this.length + other.length);
	  rt.set(this._bytes);
	  rt.set(other._bytes, this.length);
	  return new _Bytes(rt);
	}
	async gitSha1Hex() {
	  return (await _Bytes.ofUtf8(`blob ${this.length}\0`).concat(this).sha1()).hex();
	}
	async hmacSha1(key) {
	  const cryptoKey = await cryptoSubtle().importKey("raw", key._bytes, { name: "HMAC", hash: "SHA-1" }, true, ["sign"]);
	  const sig = await cryptoSubtle().sign("HMAC", cryptoKey, this._bytes);
	  return new _Bytes(new Uint8Array(sig));
	}
	async sha256() {
	  const hash = await cryptoSubtle().digest("SHA-256", this._bytes);
	  return new _Bytes(new Uint8Array(hash));
	}
	async hmacSha256(key) {
	  const cryptoKey = await cryptoSubtle().importKey("raw", key._bytes, { name: "HMAC", hash: "SHA-256" }, true, ["sign"]);
	  const sig = await cryptoSubtle().sign("HMAC", cryptoKey, this._bytes);
	  return new _Bytes(new Uint8Array(sig));
	}
	hex() {
	  const a = Array.from(this._bytes);
	  return a.map((b) => b.toString(16).padStart(2, "0")).join("");
	}
	static ofHex(hex2) {
	  if (hex2 === "") {
		return _Bytes.EMPTY;
	  }
	  return new _Bytes(new Uint8Array(hex2.match(/.{1,2}/g).map((byte) => parseInt(byte, 16))));
	}
	utf8() {
	  return new TextDecoder().decode(this._bytes);
	}
	static ofUtf8(str) {
	  return new _Bytes(new TextEncoder().encode(str));
	}
	base64() {
	  return base64Encode(this._bytes);
	}
	static ofBase64(base64, opts = { urlSafe: false }) {
	  return new _Bytes(base64Decode(base64, opts.urlSafe));
	}
	static async ofStream(stream) {
	  const chunks = [];
	  for await (const chunk of stream) {
		chunks.push(chunk);
	  }
	  const len = chunks.reduce((prev, current) => prev + current.length, 0);
	  const rt = new Uint8Array(len);
	  let offset = 0;
	  for (const chunk of chunks) {
		rt.set(chunk, offset);
		offset += chunk.length;
	  }
	  return new _Bytes(rt);
	}
	static formatSize(sizeInBytes) {
	  const sign = sizeInBytes < 0 ? "-" : "";
	  let size = Math.abs(sizeInBytes);
	  if (size < 1024)
		return `${sign}${size}bytes`;
	  size = size / 1024;
	  if (size < 1024)
		return `${sign}${roundToOneDecimal(size)}kb`;
	  size = size / 1024;
	  return `${sign}${roundToOneDecimal(size)}mb`;
	}
  };
  _Bytes.EMPTY = new _Bytes(new Uint8Array(0));
  var Bytes = _Bytes;
  function roundToOneDecimal(value) {
	return Math.round(value * 10) / 10;
  }
  function base64Encode(buf) {
	let string = "";
	buf.forEach(
	  (byte) => {
		string += String.fromCharCode(byte);
	  }
	);
	return btoa(string);
  }
  function base64Decode(str, urlSafe) {
	if (urlSafe)
	  str = str.replace(/_/g, "/").replace(/-/g, "+");
	str = atob(str);
	const length = str.length, buf = new ArrayBuffer(length), bufView = new Uint8Array(buf);
	for (let i = 0; i < length; i++) {
	  bufView[i] = str.charCodeAt(i);
	}
	return bufView;
  }
  function cryptoSubtle() {
	return crypto.subtle;
  }

  // check.ts
  function checkEqual(name, value, expected) {
	if (value !== expected)
	  throw new Error(`Bad ${name}: expected ${expected}, found ${value}`);
  }
  function check(name, value, isValid) {
	const valid = typeof isValid === "boolean" && isValid || typeof isValid === "function" && isValid(value);
	if (!valid)
	  throw new Error(`Bad ${name}: ${value}`);
  }

  // mqtt/mqtt.ts
  var Mqtt = class {
  };
  /** Enable debug-level logging throughout MqttClient and its dependencies. */
  Mqtt.DEBUG = false;
  function encodeVariableByteInteger(value) {
	const rt = [];
	do {
	  let encodedByte = value % 128;
	  value = Math.floor(value / 128);
	  if (value > 0) {
		encodedByte = encodedByte | 128;
	  }
	  rt.push(encodedByte);
	} while (value > 0);
	return rt;
  }
  function decodeVariableByteInteger(buffer, startIndex) {
	let i = startIndex;
	let encodedByte = 0;
	let value = 0;
	let multiplier = 1;
	do {
	  encodedByte = buffer[i++];
	  value += (encodedByte & 127) * multiplier;
	  if (multiplier > 128 * 128 * 128)
		throw Error("malformed length");
	  multiplier *= 128;
	} while ((encodedByte & 128) != 0);
	return { value, bytesUsed: i - startIndex };
  }
  function encodeUtf8(value) {
	const arr = encoder.encode(value);
	if (arr.length > 65535)
	  throw new Error("the maximum size of a UTF-8 Encoded String is 65,535 bytes.");
	const lengthBytes = [arr.length >> 8, arr.length & 255];
	return [...lengthBytes, ...arr];
  }
  function decodeUtf8(buffer, startIndex) {
	const length = (buffer[startIndex] << 8) + buffer[startIndex + 1];
	const bytes = buffer.slice(startIndex + 2, startIndex + 2 + length);
	const text = decoder.decode(bytes);
	return { text, bytesUsed: length + 2 };
  }
  function hex(bytes) {
	return new Bytes(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)).hex();
  }
  var encoder = new TextEncoder();
  var decoder = new TextDecoder();

  // mqtt/mqtt_messages.ts
  function readMessage(reader) {
	const { DEBUG } = Mqtt;
	if (reader.remaining() < 2)
	  return { needsMoreBytes: 2 };
	const first = reader.readUint8();
	const controlPacketType = first >> 4;
	const controlPacketFlags = first & 15;
	const remainingLength = reader.readVariableByteInteger();
	if (reader.remaining() < remainingLength)
	  return { needsMoreBytes: remainingLength };
	const remainingBytes = reader.readBytes(remainingLength);
	if (DEBUG)
	  console.log(`readMessage: ${hex([first, ...encodeVariableByteInteger(remainingLength), ...remainingBytes])}`);
	const messageReader = new Reader(remainingBytes, 0);
	if (controlPacketType === CONNACK)
	  return readConnack(messageReader, controlPacketFlags);
	if (controlPacketType === PUBLISH)
	  return readPublish(messageReader, controlPacketFlags);
	if (controlPacketType === SUBACK)
	  return readSuback(messageReader, controlPacketFlags);
	if (controlPacketType === UNSUBACK)
	  return readUnsuback(messageReader, controlPacketFlags);
	if (controlPacketType === PINGRESP)
	  return readPingresp(messageReader, controlPacketFlags);
	if (controlPacketType === DISCONNECT)
	  return readDisconnect(messageReader, controlPacketFlags, remainingLength);
	throw new Error(`readMessage: Unsupported controlPacketType: ${controlPacketType}`);
  }
  function encodeMessage(message) {
	if (message.type === CONNECT)
	  return encodeConnect(message);
	if (message.type === PUBLISH)
	  return encodePublish(message);
	if (message.type === SUBSCRIBE)
	  return encodeSubscribe(message);
	if (message.type === UNSUBSCRIBE)
	  return encodeUnsubscribe(message);
	if (message.type === PINGREQ)
	  return encodePingreq(message);
	if (message.type === DISCONNECT)
	  return encodeDisconnect(message);
	throw new Error(`encodeMessage: Unsupported controlPacketType: ${message.type}`);
  }
  function computeControlPacketTypeName(type) {
	if (type === CONNECT)
	  return "CONNECT";
	if (type === CONNACK)
	  return "CONNACK";
	if (type === PUBLISH)
	  return "PUBLISH";
	if (type === SUBSCRIBE)
	  return "SUBSCRIBE";
	if (type === SUBACK)
	  return "SUBACK";
	if (type === UNSUBSCRIBE)
	  return "UNSUBSCRIBE";
	if (type === UNSUBACK)
	  return "UNSUBACK";
	if (type === PINGREQ)
	  return "PINGREQ";
	if (type === PINGRESP)
	  return "PINGRESP";
	if (type === DISCONNECT)
	  return "DISCONNECT";
	throw new Error(`computeControlPacketTypeName: Unsupported controlPacketType: ${type}`);
  }
  var CONNECT = 1;
  function encodeConnect(message) {
	const { type, keepAlive, clientId, username, password, clean } = message;
	const connectFlags = (username ? 1 : 0) << 7 | 1 << 6 | (clean ? 1 : 0) << 1;
	const variableHeader = [
	  ...encodeUtf8("MQTT"),
	  // protocol name
	  5,
	  // protocol version
	  connectFlags,
	  ...encodeUint16(keepAlive),
	  ...encodeVariableByteInteger(0)
	  // properties = none
	];
	const payload = [
	  ...encodeUtf8(clientId),
	  ...username ? encodeUtf8(username) : [],
	  ...encodeUtf8(password)
	];
	return encodePacket(type, { variableHeader, payload });
  }
  var CONNACK = 2;
  function readConnack(reader, controlPacketFlags) {
	const { DEBUG } = Mqtt;
	//checkEqual("controlPacketFlags", controlPacketFlags, 0);
	const connectAcknowledgeFlags = reader.readUint8();
	const sessionPresent = (connectAcknowledgeFlags & 1) === 1;
	const connectAcknowledgeFlagsReserved = connectAcknowledgeFlags & 254;
	if (DEBUG)
	  console.log({ sessionPresent, connectAcknowledgeFlagsReserved });
	checkEqual("connectAcknowledgeFlagsReserved", connectAcknowledgeFlagsReserved, 0);
	let rt = { type: CONNACK, sessionPresent };
	rt = { ...rt, reason: readReason(reader, CONNACK_REASONS) };
	if (reader.remaining() > 0) {
	  readProperties(reader, (propertyId) => {
		if (propertyId === 17) {
		  const sessionExpiryInterval = reader.readUint32();
		  if (DEBUG)
			console.log({ sessionExpiryInterval });
		  rt = { ...rt, sessionExpiryInterval };
		} else if (propertyId === 36) {
		  const maximumQos = reader.readUint8();
		  if (DEBUG)
			console.log({ maximumQos });
		  check("maximumQos", maximumQos, maximumQos === 0 || maximumQos === 1);
		  rt = { ...rt, maximumQos };
		} else if (propertyId === 37) {
		  rt = { ...rt, retainAvailable: readBooleanProperty("retainAvailable", reader) };
		} else if (propertyId === 39) {
		  const maximumPacketSize = reader.readUint32();
		  if (DEBUG)
			console.log({ maximumPacketSize });
		  rt = { ...rt, maximumPacketSize };
		} else if (propertyId === 33) {
			const receiveMaximum = reader.readUint16();
			if (DEBUG)
				console.log({ receiveMaximum });
			rt = { ...rt, receiveMaximum };
		} else if (propertyId === 34) {
		  const topicAliasMaximum = reader.readUint16();
		  if (DEBUG)
			console.log({ topicAliasMaximum });
		  rt = { ...rt, topicAliasMaximum };
		} else if (propertyId === 40) {
		  rt = { ...rt, wildcardSubscriptionAvailable: readBooleanProperty("wildcardSubscriptionAvailable", reader) };
		} else if (propertyId === 41) {
		  rt = { ...rt, subscriptionIdentifiersAvailable: readBooleanProperty("subscriptionIdentifiersAvailable", reader) };
		} else if (propertyId === 42) {
		  rt = { ...rt, sharedSubscriptionAvailable: readBooleanProperty("sharedSubscriptionAvailable", reader) };
		} else if (propertyId === 19) {
		  const serverKeepAlive = reader.readUint16();
		  if (DEBUG)
			console.log({ serverKeepAlive });
		  rt = { ...rt, serverKeepAlive };
		} else if (propertyId === 18) {
		  const assignedClientIdentifier = reader.readUtf8();
		  if (DEBUG)
			console.log({ assignedClientIdentifier });
		  rt = { ...rt, assignedClientIdentifier };
		} else {
		  throw new Error(`Unsupported propertyId: ${propertyId}`);
		}
	  });
	}
	checkEqual("remaining", reader.remaining(), 0);
	return rt;
  }
  var CONNACK_REASONS = {
	// 3.2.2.2 Connect Reason Code
	0: ["Success", "The Connection is accepted."],
	128: ["Unspecified error", "The Server does not wish to reveal the reason for the failure, or none of the other Reason Codes apply."],
	129: ["Malformed Packet", "Data within the CONNECT packet could not be correctly parsed."],
	130: ["Protocol Error", "Data in the CONNECT packet does not conform to this specification."],
	131: ["Implementation specific error", "The CONNECT is valid but is not accepted by this Server."],
	132: ["Unsupported Protocol Version", "The Server does not support the version of the MQTT protocol requested by the Client."],
	133: ["Client Identifier not valid", "The Client Identifier is a valid string but is not allowed by the Server."],
	134: ["Bad User Name or Password", "The Server does not accept the User Name or Password specified by the Client"],
	135: ["Not authorized", "The Client is not authorized to connect."],
	136: ["Server unavailable", "The MQTT Server is not available."],
	137: ["Server busy", "The Server is busy. Try again later."],
	138: ["Banned", "This Client has been banned by administrative action. Contact the server administrator."],
	140: ["Bad authentication method", "The authentication method is not supported or does not match the authentication method currently in use."],
	144: ["Topic Name invalid", "The Will Topic Name is not malformed, but is not accepted by this Server."],
	149: ["Packet too large", "The CONNECT packet exceeded the maximum permissible size."],
	151: ["Quota exceeded", "An implementation or administrative imposed limit has been exceeded."],
	153: ["Payload format invalid", "The Will Payload does not match the specified Payload Format Indicator."],
	154: ["Retain not supported", "The Server does not support retained messages, and Will Retain was set to 1."],
	155: ["QoS not supported", "The Server does not support the QoS set in Will QoS."],
	156: ["Use another server", "The Client should temporarily use another server."],
	157: ["Server moved", "The Client should permanently use another server."],
	159: ["Connection rate exceeded", "The connection rate limit has been exceeded."]
  };
  var PUBLISH = 3;
  function readPublish(reader, controlPacketFlags) {
	const { DEBUG } = Mqtt;
	//checkEqual("controlPacketFlags", controlPacketFlags, 0);
	const dup = (controlPacketFlags & 8) === 8;
	const qosLevel = (controlPacketFlags & 6) >> 1;
	const retain = (controlPacketFlags & 1) === 1;
	if (DEBUG)
	  console.log({ dup, qosLevel, retain });
	if (qosLevel !== 0 && qosLevel !== 1 && qosLevel !== 2)
	  throw new Error(`Bad qosLevel: ${qosLevel}`);
	const topic = reader.readUtf8();
	let rt = { type: PUBLISH, dup, qosLevel, retain, topic, payload: EMPTY_BYTES };
	if (qosLevel === 1 || qosLevel === 2) {
	  rt = { ...rt, packetId: reader.readUint16() };
	}
	readProperties(reader, (propertyId) => {
	  if (propertyId === 1) {
		const payloadFormatIndicator = reader.readUint8();
		if (DEBUG)
		  console.log({ payloadFormatIndicator });
		check("payloadFormatIndicator", payloadFormatIndicator, payloadFormatIndicator === 0 || payloadFormatIndicator === 1);
		rt = { ...rt, payloadFormatIndicator };
	  } else if (propertyId === 3) {
		const contentType = reader.readUtf8();
		if (DEBUG)
		  console.log({ contentType });
		rt = { ...rt, contentType };
	  } else {
		throw new Error(`Unsupported propertyId: ${propertyId}`);
	  }
	});
	rt = { ...rt, payload: reader.readBytes(reader.remaining()) };
	return rt;
  }
  function encodePublish(message) {
	const { payloadFormatIndicator, topic, payload, type, dup, qosLevel, retain, packetId, contentType } = message;
	if (qosLevel === 1 || qosLevel === 2) {
	  if (packetId === void 0)
		throw new Error(`Missing packetId: required with qosLevel ${qosLevel}`);
	} else if (qosLevel === 0) {
	  if (packetId !== void 0)
		throw new Error(`Bad packetId: not applicable with qosLevel 0`);
	} else {
	  throw new Error(`Bad qosLevel: ${qosLevel}`);
	}
	const controlPacketFlags = (dup ? 1 << 3 : 0) | qosLevel % 4 << 1 | (retain ? 1 : 0);
	const properties = [
	  ...payloadFormatIndicator === void 0 ? [] : [1, payloadFormatIndicator],
	  // 3.3.2.3.2 Payload Format Indicator
	  ...contentType === void 0 ? [] : [3, ...encodeUtf8(contentType)]
	  // 3.3.2.3.9 Content Type
	];
	const variableHeader = [
	  ...encodeUtf8(topic),
	  ...packetId === void 0 ? [] : encodeUint16(packetId),
	  ...encodeVariableByteInteger(properties.length),
	  ...properties
	];
	return encodePacket(type, { controlPacketFlags, variableHeader, payload });
  }
  var SUBSCRIBE = 8;
  function encodeSubscribe(message) {
	const { type, packetId, subscriptions } = message;
	const controlPacketFlags = 2;
	const variableHeader = [
	  ...encodeUint16(packetId),
	  ...encodeVariableByteInteger(0)
	  // properties = none
	];
	const payload = subscriptions.flatMap((v) => [
	  ...encodeUtf8(v.topicFilter),
	  0
	  /* qos 0, no no-local, no retain as published, retain handling = Send retained messages at the time of the subscribe */
	]);
	return encodePacket(type, { controlPacketFlags, variableHeader, payload });
  }
  var SUBACK = 9;
  function readSuback(reader, controlPacketFlags) {
	checkEqual("controlPacketFlags", controlPacketFlags, 0);
	const packetId = reader.readUint16();
	const rt = { type: SUBACK, packetId, reasons: [] };
	readProperties(reader, (propertyId) => {
	  throw new Error(`Unsupported propertyId: ${propertyId}`);
	});
	while (reader.remaining() > 0) {
	  rt.reasons.push(readReason(reader, SUBACK_REASONS));
	}
	return rt;
  }
  var SUBACK_REASONS = {
	// 3.9.3 SUBACK Payload
	0: ["Granted QoS 0", "The subscription is accepted and the maximum QoS sent will be QoS 0. This might be a lower QoS than was requested."],
	1: ["Granted QoS 1", "The subscription is accepted and the maximum QoS sent will be QoS 1. This might be a lower QoS than was requested."],
	2: ["Granted QoS 2", "The subscription is accepted and any received QoS will be sent to this subscription."],
	128: ["Unspecified error", "The subscription is not accepted and the Server either does not wish to reveal the reason or none of the other Reason Codes apply."],
	131: ["Implementation specific error", "The SUBSCRIBE is valid but the Server does not accept it."],
	135: ["Not authorized", "The Client is not authorized to make this subscription."],
	143: ["Topic Filter invalid", "The Topic Filter is correctly formed but is not allowed for this Client."],
	145: ["Packet Identifier in use", "The specified Packet Identifier is already in use."],
	151: ["Quota exceeded", "An implementation or administrative imposed limit has been exceeded."],
	158: ["Shared Subscriptions not supported", "The Server does not support Shared Subscriptions for this Client."],
	161: ["Subscription Identifiers not supported", "The Server does not support Subscription Identifiers; the subscription is not accepted."],
	162: ["Wildcard Subscriptions not supported", "The Server does not support Wildcard Subscriptions; the subscription is not accepted."]
  };
  var UNSUBSCRIBE = 10;
  function encodeUnsubscribe(message) {
	const { type, packetId, unsubscriptions } = message;
	const variableHeader = [
	  ...encodeUint16(packetId),
	  ...encodeVariableByteInteger(0)
	  // properties = none
	];
	const payload = unsubscriptions.flatMap((v) => [...encodeUtf8(v.topicFilter)]);
	return encodePacket(type, { variableHeader, payload });
  }
  var UNSUBACK = 11;
  function readUnsuback(reader, controlPacketFlags) {
	checkEqual("controlPacketFlags", controlPacketFlags, 0);
	const packetId = reader.readUint16();
	const rt = { type: UNSUBACK, packetId, reasons: [] };
	readProperties(reader, (propertyId) => {
	  throw new Error(`Unsupported propertyId: ${propertyId}`);
	});
	while (reader.remaining() > 0) {
	  rt.reasons.push(readReason(reader, UNSUBACK_REASONS));
	}
	return rt;
  }
  var UNSUBACK_REASONS = {
	0: ["Success", "The subscription is deleted."],
	17: ["No subscription existed", "No matching Topic Filter is being used by the Client."],
	128: ["Unspecified error", "The unsubscribe could not be completed and the Server either does not wish to reveal the reason or none of the other Reason Codes apply."],
	131: ["Implementation specific error", "The UNSUBSCRIBE is valid but the Server does not accept it."],
	135: ["Not authorized", "The Client is not authorized to unsubscribe."],
	143: ["Topic Filter invalid", "The Topic Filter is correctly formed but is not allowed for this Client."],
	145: ["Packet Identifier in use", "The specified Packet Identifier is already in use."]
  };
  var PINGREQ = 12;
  function encodePingreq(message) {
	const { type } = message;
	return encodePacket(type);
  }
  var PINGRESP = 13;
  function readPingresp(reader, controlPacketFlags) {
	checkEqual("controlPacketFlags", controlPacketFlags, 0);
	checkEqual("remaining", reader.remaining(), 0);
	return { type: PINGRESP };
  }
  var DISCONNECT = 14;
  function readDisconnect(reader, controlPacketFlags, remainingLength) {
	checkEqual("controlPacketFlags", controlPacketFlags, 0);
	let rt = { type: DISCONNECT };
	if (remainingLength > 0) {
	  rt = { ...rt, reason: readReason(reader, DISCONNECT_REASONS) };
	}
	if (remainingLength > 1) {
	  readProperties(reader, (propertyId) => {
		throw new Error(`Unsupported propertyId: ${propertyId}`);
	  });
	}
	checkEqual("remaining", reader.remaining(), 0);
	return rt;
  }
  var DISCONNECT_REASONS = {
	// 3.14.2.1 Disconnect Reason Code
	0: ["Normal disconnection", "Close the connection normally. Do not send the Will Message."],
	4: ["Disconnect with Will Message", "The Client wishes to disconnect but requires that the Server also publishes its Will Message."],
	128: ["Unspecified error", "The Connection is closed but the sender either does not wish to reveal the reason, or none of the other Reason Codes apply."],
	129: ["Malformed Packet", "The received packet does not conform to this specification."],
	130: ["Protocol Error", "An unexpected or out of order packet was received."],
	131: ["Implementation specific error", "The packet received is valid but cannot be processed by this implementation."],
	135: ["Not authorized", "The request is not authorized."],
	137: ["Server busy", "The Server is busy and cannot continue processing requests from this Client."],
	139: ["Server shutting down", "The Server is shutting down."],
	141: ["Keep Alive timeout", "The Connection is closed because no packet has been received for 1.5 times the Keepalive time."],
	142: ["Session taken over", "Another Connection using the same ClientID has connected causing this Connection to be closed."],
	143: ["Topic Filter invalid", "The Topic Filter is correctly formed, but is not accepted by this Sever."],
	144: ["Topic Name invalid", "The Topic Name is correctly formed, but is not accepted by this Client or Server."],
	147: ["Receive Maximum exceeded", "The Client or Server has received more than Receive Maximum publication for which it has not sent PUBACK or PUBCOMP."],
	148: ["Topic Alias invalid", "The Client or Server has received a PUBLISH packet containing a Topic Alias which is greater than the Maximum Topic Alias it sent in the CONNECT or CONNACK packet."],
	149: ["Packet too large", "The packet size is greater than Maximum Packet Size for this Client or Server."],
	150: ["Message rate too high", "The received data rate is too high."],
	151: ["Quota exceeded", "An implementation or administrative imposed limit has been exceeded."],
	152: ["Administrative action", "The Connection is closed due to an administrative action."],
	153: ["Payload format invalid", "The payload format does not match the one specified by the Payload Format Indicator."],
	154: ["Retain not supported", "The Server has does not support retained messages."],
	155: ["QoS not supported", "The Client specified a QoS greater than the QoS specified in a Maximum QoS in the CONNACK."],
	156: ["Use another server", "The Client should temporarily change its Server."],
	157: ["Server moved", "The Server is moved and the Client should permanently change its server location."],
	158: ["Shared Subscriptions not supported", "The Server does not support Shared Subscriptions."],
	159: ["Connection rate exceeded", "This connection is closed because the connection rate is too high."],
	160: ["Maximum connect time", "The maximum connection time authorized for this connection has been exceeded."],
	161: ["Subscription Identifiers not supported", "The Server does not support Subscription Identifiers; the subscription is not accepted."],
	162: ["Wildcard Subscriptions not supported", "The Server does not support Wildcard Subscriptions; the subscription is not accepted."]
  };
  function encodeDisconnect(message) {
	const { type, reason } = message;
	const reasonCode = reason?.code ?? 0;
	const variableHeader = [
	  reasonCode
	];
	return encodePacket(type, { variableHeader });
  }
  function readReason(reader, table) {
	const { DEBUG } = Mqtt;
	const code = reader.readUint8();
	const [name, description] = table[code] ?? [void 0, void 0];
	const reason = { code, name, description };
	if (DEBUG)
	  console.log({ reason });
	return reason;
  }
  var EMPTY_BYTES = new Uint8Array(0);
  function readProperties(reader, handler) {
	const { DEBUG } = Mqtt;
	const propertiesLength = reader.readVariableByteInteger();
	if (DEBUG)
	  console.log({ propertiesLength });
	const propertiesEnd = reader.position + propertiesLength;
	while (reader.position < propertiesEnd) {
	  const propertyId = reader.readVariableByteInteger();
	  if (DEBUG)
		console.log({ propertyId });
	  handler(propertyId);
	}
  }
  function readBooleanProperty(name, reader) {
	const { DEBUG } = Mqtt;
	const value = reader.readUint8();
	if (DEBUG)
	  console.log(Object.fromEntries([[name, value]]));
	check(name, value, value === 0 || value === 1);
	return value === 1;
  }
  function encodeUint16(value) {
	const buffer = new ArrayBuffer(2);
	const view = new DataView(buffer);
	view.setUint16(0, value);
	return new Uint8Array(buffer);
  }
  function encodePacket(controlPacketType, opts = {}) {
	const { DEBUG } = Mqtt;
	const { controlPacketFlags = 0, variableHeader = [], payload = [] } = opts;
	const remainingLength = variableHeader.length + payload.length;
	if (DEBUG)
	  console.log({ remainingLength, variableHeaderLength: variableHeader.length, payloadLength: payload.length });
	const fixedHeader = [controlPacketType << 4 | controlPacketFlags, ...encodeVariableByteInteger(remainingLength)];
	if (DEBUG)
	  console.log(`fixedHeader: ${hex(fixedHeader)}`);
	if (DEBUG)
	  console.log(`variableHeader: ${hex(variableHeader)}`);
	if (DEBUG)
	  console.log(`payload: ${hex(payload)}`);
	const packet = new Uint8Array([...fixedHeader, ...variableHeader, ...payload]);
	if (DEBUG)
	  console.log(`packet: ${hex(packet)}`);
	return packet;
  }
  var Reader = class {
	constructor(bytes, offset) {
	  this.bytes = bytes;
	  this.view = new DataView(bytes.buffer, offset);
	  this.position = offset;
	}
	remaining() {
	  return this.bytes.length - this.position;
	}
	readUint8() {
	  this.ensureCapacity(1);
	  return this.view.getUint8(this.position++);
	}
	readUint32() {
	  this.ensureCapacity(4);
	  const rt = this.view.getUint32(this.position);
	  this.position += 4;
	  return rt;
	}
	readUint16() {
	  this.ensureCapacity(2);
	  const rt = this.view.getUint16(this.position);
	  this.position += 2;
	  return rt;
	}
	readVariableByteInteger() {
	  this.ensureCapacity(1);
	  const { value, bytesUsed } = decodeVariableByteInteger(this.bytes, this.position);
	  this.position += bytesUsed;
	  return value;
	}
	readUtf8() {
	  this.ensureCapacity(2);
	  const { text, bytesUsed } = decodeUtf8(this.bytes, this.position);
	  this.position += bytesUsed;
	  return text;
	}
	readBytes(length) {
	  this.ensureCapacity(length);
	  const rt = this.bytes.slice(this.position, this.position + length);
	  this.position += length;
	  return rt;
	}
	//
	ensureCapacity(length) {
	  const remaining = this.remaining();
	  if (remaining < length)
		throw new Error(`reader needs ${length} bytes, has ${remaining} remaining`);
	}
  };

  // mqtt/web_socket_connection.ts
  var WebSocketConnection = class _WebSocketConnection {
	constructor(ws) {
	  this.onRead = () => {
	  };
	  const { DEBUG } = Mqtt;
	  this.ws = ws;
	  this.completionPromise = new Promise((resolve, reject) => {
		ws.addEventListener("close", (event) => {
		  if (DEBUG)
			console.log("ws close", event, JSON.stringify(event));
		  resolve();
		});
		ws.addEventListener("error", (event) => {
		  if (DEBUG)
			console.log("ws error", event);
		  reject(event.message ?? event);
		});
	  });
	  ws.addEventListener("message", async (event) => {
		if (DEBUG)
		  console.log("ws message", typeof event.data, event.data);
		if (event.data instanceof Blob) {
		  const bytes = new Uint8Array(await event.data.arrayBuffer());
		  this.onRead(bytes);
		} else if (event.data instanceof Uint8Array) {
		  let bytes = event.data;
		  if (bytes.constructor.name === "Buffer") {
			bytes = new Uint8Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
		  }
		  this.onRead(bytes);
		} else if (event.data instanceof ArrayBuffer) {
		  const bytes = new Uint8Array(event.data);
		  this.onRead(bytes);
		} else {
		  throw new Error(`Unsupported event.data: ${event.data.constructor.name}`);
		}
	  });
	  ws.addEventListener("open", (event) => {
		if (DEBUG)
		  console.log("ws open", event);
	  });
	}
	static async create(opts) {
	  const { DEBUG } = Mqtt;
	  const { hostname, port, pathname } = opts;
	  if ("accept" in WebSocket.prototype) {
		if (DEBUG)
		  console.log("Found WebSocket.accept, using Cloudflare workaround");
		if (port !== 443)
		  throw new Error(`Cloudflare Workers only support outgoing WebSocket requests on port 443 (https)`);
		const url2 = `https://${hostname}${port ? `:${port}` : ''}${pathname ?? ''}`;
		if (DEBUG)
		  console.log(`Fetching ${url2}`);
		const resp = await fetch(url2, { headers: { upgrade: "websocket" } });
		const { webSocket } = resp;
		if (typeof webSocket !== "object")
		  throw new Error(`Cloudflare fetch response for upgrade request returned no WebSocket`);
		if (DEBUG)
		  console.log("Calling WebSocket.accept()");
		webSocket.accept();
		if (DEBUG)
		  console.log("Accepted!");
		return new _WebSocketConnection(webSocket);
	  }
	  const url = `wss://${hostname}${port ? `:${port}` : ''}${pathname ?? ''}`;
	  const ws = new WebSocket(url, "mqtt");
	  if (DEBUG)
		console.log(`new WebSocket('${url}', 'mqtt')`);
	  return new Promise((resolve, reject) => {
		let resolved = false;
		ws.addEventListener("open", (event) => {
		  if (resolved)
			return;
		  if (DEBUG)
			console.log("ws open", event);
		  resolved = true;
		  resolve(new _WebSocketConnection(ws));
		});
		ws.addEventListener("error", (event) => {
		  if (resolved)
			return;
		  if (DEBUG)
			console.log("ws error", event);
		  resolved = true;
		  reject(event);
		});
	  });
	}
	write(bytes) {
	  this.ws.send(bytes);
	  return Promise.resolve(bytes.length);
	}
	close() {
	  this.ws.close();
	}
  };

  // mqtt/mqtt_client.ts
  var DEFAULT_KEEP_ALIVE_SECONDS = 10;
  var MAX_PACKET_IDS = 256 * 256;
  var _MqttClient = class _MqttClient {
	/**
	 * Creates a new MqttClient.
	 *
	 * - `hostname`: MQTT endpoint hostname.  e.g. my-broker.my-namespace.cloudflarepubsub.com
	 * - `port`: MQTT endpoint port.  e.g. 8884 for web sockets
	 * - `protocol`: MQTT endpoint protocol.  e.g. 'wss' for web sockets
	 * - `maxMessagesPerSecond`: Optional, but can be used to rate limit outgoing messages if needed by the endpoint.
	 *
	 * Once created, call `connect` to connect.
	 */
	constructor(opts) {
	  /** @internal */
	  this.obtainedPacketIds = [];
	  /** @internal */
	  this.pendingSubscribes = {};
	  /** @internal */
	  this.pendingUnsubscribes = {};
	  /** @internal */
	  this.savedBytes = [];
	  /** @internal */
	  this.pingTimeout = 0;
	  /** @internal */
	  this.keepAliveSeconds = DEFAULT_KEEP_ALIVE_SECONDS;
	  /** @internal */
	  this.lastSentMessageTime = 0;
	  /** @internal */
	  this.receivedDisconnect = false;
	  /** @internal */
	  this.nextPacketId = 1;
	  const { hostname, port, pathname, protocol, maxMessagesPerSecond } = opts;
	  this.hostname = hostname;
	  this.port = port;
	  this.pathname = pathname;
	  this.protocol = protocol;
	  this.maxMessagesPerSecond = maxMessagesPerSecond;
	}
	/**
	 * Returns the session client id negotiated during initial connection.
	 *
	 * This will be the one provided explicitiy in `connect`, unless the server assigns one when it acknowledges the connection.
	*/
	get clientId() {
	  return this.clientIdInternal;
	}
	/**
	 * Returns the session keep-alive negotiated during initial connection.
	 *
	 * MqttClient will automatically send underlying MQTT pings on this interval.
	 */
	get keepAlive() {
	  return this.keepAliveSeconds;
	}
	/**
	 * When connected, resolves when the underlying connection is closed.
	 *
	 * Useful to await when wanting to listen "forever" to a subscription without exiting your program.
	 */
	completion() {
	  return this.connectionCompletion ?? Promise.resolve();
	}
	/** Returns whether or not this client is connected. */
	connected() {
	  return this.connection !== void 0;
	}
	/**
	 * Connect and authenticate with the server.
	 *
	 * Resolves when the server acknowledges a successful connection, otherwise rejects.
	 *
	 * - `clientId`: Optional if the server assigns a client id (e.g. based on the password).
	 * - `username`: Optional for some servers.
	 * - `password`: The password to use when initiating the connection.
	 * - `keepAlive`: Desired keep-alive, in seconds.  Note the server can override this, the resolved value is available in `keepAlive` once connected.
	 */
	async connect(opts) {
	  const { DEBUG } = Mqtt;
	  const { clientId = "", username, password, keepAlive = DEFAULT_KEEP_ALIVE_SECONDS, clean = false } = opts;
	  const { protocol, hostname, port, pathname } = this;
	  if (!this.connection) {
		this.connection = await _MqttClient.protocolHandlers[protocol]({ hostname, port, pathname });
		this.connection.onRead = (bytes) => {
		  this.processBytes(bytes);
		};
		this.connectionCompletion = this.connection.completionPromise.then(() => {
		  if (DEBUG)
			console.log("read loop done");
		  this.clearPing();
		  this.connection = void 0;
		  if (this.pendingConnect) {
			this.pendingConnect.reject("Connect failed, connection closed");
			this.pendingConnect = void 0;
		  }
		}, (e) => {
		  console.log(`unhandled read loop error: ${e.stack || e}`);
		  this.clearPing();
		});
	  }
	  this.pendingConnect = new Signal();
	  this.keepAliveSeconds = keepAlive;
	  this.clientIdInternal = clientId;
	  await this.sendMessage({ type: CONNECT, clientId, username, password, keepAlive, clean });
	  return this.pendingConnect.promise;
	}
	/**
	 * Disconnect from the server.
	 *
	 * Resolves after the disconnect request is sent.
	 */
	async disconnect() {
	  await this.sendMessage({ type: DISCONNECT, reason: {
		code: 0
		/* normal disconnection */
	  } });
	  this.connection = void 0;
	}
	/**
	 * Send a message for a given topic.
	 *
	 * - `topic`: Required name of the topic on which the post the message.
	 * - `payload`: Use a string to send a text payload, else a Uint8Array to send arbitrary bytes.
	 * - `contentType`: Optional MIME type of the payload.
	 */
	async publish(opts) {
	  const { topic, payload: inputPayload, contentType } = opts;
	  const payloadFormatIndicator = typeof inputPayload === "string" ? 1 : 0;
	  const payload = typeof inputPayload === "string" ? Bytes.ofUtf8(inputPayload).array() : inputPayload;
	  await this.sendMessage({ type: PUBLISH, dup: false, qosLevel: 0, retain: false, topic, payload, payloadFormatIndicator, contentType });
	}
	/**
	 * Subscribe to receive messages for a given topic.
	 *
	 * Resolves when the subscription is acknowledged by the server, else rejects.
	 *
	 * Once subscribed, messages will arrive via the `onReceive` handler.
	 *
	 * - `topicFilter`: Topic name to listen to.
	 */
	async subscribe(opts) {
	  const topicFilter = opts.topicFilter ?? opts;
	  const packetId = this.obtainPacketId();
	  const subscriptions = Array.isArray(topicFilter) ? topicFilter.map((filter) => ({ topicFilter: filter })) : [{ topicFilter }];
	  const signal = new Signal();
	  this.pendingSubscribes[packetId] = signal;
	  await this.sendMessage({ type: SUBSCRIBE, packetId, subscriptions });
	  return signal.promise;
	}
	/**
	 * Unsubscribe from messages for a given topic.
	 *
	 * Resolves when the unsubscribe is acknowledged by the server, else rejects.
	 *
	 * - `topicFilter:` Topic name to stop listening to
	 */
	async unsubscribe(opts) {
	  const topicFilter = opts.topicFilter ?? opts;
	  const packetId = this.obtainPacketId();
	  const unsubscriptions = Array.isArray(topicFilter) ? topicFilter.map((filter) => ({ topicFilter: filter })) : [{ topicFilter }];
	  const signal = new Signal();
	  this.pendingUnsubscribes[packetId] = signal;
	  await this.sendMessage({ type: UNSUBSCRIBE, packetId, unsubscriptions });
	  return signal.promise;
	}
	//
	/** @internal */
	async ping() {
	  await this.sendMessage({ type: PINGREQ });
	}
	/** @internal */
	obtainPacketId() {
	  const { DEBUG } = Mqtt;
	  const { nextPacketId, obtainedPacketIds } = this;
	  for (let i = 0; i < MAX_PACKET_IDS; i++) {
		const candidate = (nextPacketId + i) % MAX_PACKET_IDS;
		if (candidate !== 0 && !obtainedPacketIds.includes(candidate)) {
		  obtainedPacketIds.push(candidate);
		  if (DEBUG)
			console.log(`Obtained packetId: ${candidate}`);
		  this.nextPacketId = (candidate + 1) % MAX_PACKET_IDS;
		  return candidate;
		}
	  }
	  throw new Error(`obtainPacketId: Unable to obtain a packet id`);
	}
	/** @internal */
	releasePacketId(packetId) {
	  const { DEBUG } = Mqtt;
	  const { obtainedPacketIds } = this;
	  if (packetId < 1 || packetId >= MAX_PACKET_IDS)
		throw new Error(`releasePacketId: Bad packetId: ${packetId}`);
	  const i = obtainedPacketIds.indexOf(packetId);
	  if (i < 0)
		throw new Error(`releasePacketId: Unobtained packetId: ${packetId}`);
	  obtainedPacketIds.splice(i, 1);
	  if (DEBUG)
		console.log(`Released packetId: ${packetId}`);
	}
	/** @internal */
	processBytes(bytes) {
	  const { DEBUG } = Mqtt;
	  if (this.savedBytes.length > 0) {
		bytes = new Uint8Array([...this.savedBytes, ...bytes]);
		this.savedBytes.splice(0);
	  }
	  if (DEBUG)
		console.log("processBytes", bytes.length + " bytes");
	  if (DEBUG)
		console.log(hex(bytes));
	  const reader = new Reader(bytes, 0);
	  while (reader.remaining() > 0) {
		const start = reader.position;
		const message = readMessage(reader);
		if ("needsMoreBytes" in message) {
		  this.savedBytes.push(...bytes.slice(start));
		  return;
		}
		if (message.type === CONNACK) {
		  if (this.pendingConnect) {
			if ((message.reason?.code ?? 0) < 128) {
			  this.clientIdInternal = message.assignedClientIdentifier ?? this.clientIdInternal;
			  this.keepAliveSeconds = message.serverKeepAlive ?? this.keepAliveSeconds;
			  this.reschedulePing();
			  this.pendingConnect.resolve(message);
			} else {
			  this.pendingConnect.reject(JSON.stringify(message.reason));
			}
			this.pendingConnect = void 0;
		  }
		} else if (message.type === DISCONNECT) {
		  this.receivedDisconnect = true;
		  if (this.connection) {
			this.connection.close();
			this.connection = void 0;
		  }
		} else if (message.type === SUBACK) {
		  const { packetId, reasons } = message;
		  this.releasePacketId(packetId);
		  const signal = this.pendingSubscribes[packetId];
		  if (signal) {
			if (reasons.some((v) => v.code >= 128)) {
			  signal.reject(JSON.stringify(reasons));
			} else {
			  signal.resolve(message);
			}
			delete this.pendingSubscribes[packetId];
		  }
		} else if (message.type === UNSUBACK) {
		  const { packetId, reasons } = message;
		  this.releasePacketId(packetId);
		  const signal = this.pendingUnsubscribes[packetId];
		  if (signal) {
			if (reasons.some((v) => v.code >= 128)) {
			  signal.reject(message);
			} else {
			  signal.resolve(message);
			}
			delete this.pendingUnsubscribes[packetId];
		  }
		} else if (message.type === PINGRESP) {
		} else if (message.type === PUBLISH) {
		  const { topic, payload: messagePayload, payloadFormatIndicator, contentType } = message;
		  const payload = payloadFormatIndicator === 1 ? new Bytes(messagePayload).utf8() : messagePayload;
		  if (this.onReceive)
			this.onReceive({ topic, payload, contentType });
		} else {
		  throw new Error(`processPacket: Unsupported message type: ${message}`);
		}
		if (this.onMqttMessage)
		  this.onMqttMessage(message);
	  }
	  checkEqual("reader.remaining", reader.remaining(), 0);
	}
	/** @internal */
	clearPing() {
	  clearTimeout(this.pingTimeout);
	}
	/** @internal */
	reschedulePing() {
	  this.clearPing();
	  this.pingTimeout = setTimeout(async () => {
		await this.ping();
		this.reschedulePing();
	  }, this.keepAliveSeconds * 1e3);
	}
	/** @internal */
	async sendMessage(message) {
	  const { DEBUG } = Mqtt;
	  const { connection, maxMessagesPerSecond } = this;
	  const diff = Date.now() - this.lastSentMessageTime;
	  const intervalMillis = 1e3 / (maxMessagesPerSecond ?? 1);
	  const waitMillis = maxMessagesPerSecond !== void 0 && diff < intervalMillis ? intervalMillis - diff : 0;
	  if (DEBUG)
		console.log(`Sending ${computeControlPacketTypeName(message.type)}${waitMillis > 0 ? ` (waiting ${waitMillis}ms)` : ""}`);
	  if (waitMillis > 0)
		await sleep(waitMillis);
	  if (this.receivedDisconnect)
		throw new Error(`sendMessage: received disconnect`);
	  if (!connection)
		throw new Error(`sendMessage: no connection`);
	  await connection.write(encodeMessage(message));
	  this.lastSentMessageTime = Date.now();
	}
  };
  /**
   * Register a custom implementation for one of the supported protocols.
   *
   * e.g. you could write your own 'mqtts' TCP implementation for Node and plug it in here.
   */
  _MqttClient.protocolHandlers = {
	"mqtts": () => {
	  throw new Error(`The 'mqtts' protocol is not supported in this environment`);
	},
	"wss": WebSocketConnection.create
  };
  var MqttClient = _MqttClient;
  function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
  }
  var Signal = class {
	constructor() {
	  this.promise = new Promise((resolve, reject) => {
		this.resolve_ = resolve;
		this.reject_ = reject;
	  });
	}
	resolve(value) {
	  this.resolve_(value);
	}
	reject(reason) {
	  this.reject_(reason);
	}
  };
  export {
	CONNACK,
	CONNECT,
	DISCONNECT,
	Mqtt,
	MqttClient,
	PINGREQ,
	PINGRESP,
	PUBLISH,
	SUBACK,
	SUBSCRIBE,
	UNSUBACK,
	UNSUBSCRIBE,
	computeControlPacketTypeName
  };
