// Traducción al inglés de los documentos legales vigentes (y del borrador de
// la política de privacidad 1.2), para la migración AddLegalDocumentsEnglish.
// Es una traducción de cortesía: la versión que vale es la española. Pendiente
// de revisar con la dirección

export const TERMS_1_0_EN = `<p>Provisional text, pending review.</p>

<h2>1. What UAL Carpool is</h2>
<p>
  UAL Carpool is a platform for sharing car journeys between members of the University of Almería
  community. It is not a transport service: whoever drives shares their own journey and its costs,
  on a non-profit basis.
</p>

<h2>2. Who can use it</h2>
<p>
  People with a verified institutional email address from the University of Almería. Verifying the
  email address does not prove anyone's identity, vehicle or driving licence.
</p>

<h2>3. Driver commitments</h2>
<ul>
  <li>Hold a valid driving licence and keep the vehicle in good condition (self-declaration).</li>
  <li>Offer only as many seats as the vehicle allows.</li>
  <li>Give notice in good time if they cancel a trip.</li>
</ul>

<h2>4. Passenger commitments</h2>
<ul>
  <li>Be at the pickup point at the agreed time.</li>
  <li>Cancel the request if they are no longer travelling.</li>
</ul>

<h2>5. Respect</h2>
<p>
  Respectful treatment, without discrimination. Incidents can be reported in the app and are
  reviewed by the administration.
</p>
`;

export const DRIVER_DECLARATION_1_0_EN = `<p>Before offering your first trip, you declare that:</p>
<ul>
  <li>You hold a <strong>valid driving licence</strong>, valid in Spain for your vehicle.</li>
  <li>
    Your vehicle has <strong>valid compulsory insurance</strong> and an <strong>up-to-date MOT (ITV)</strong>, and is
    roadworthy.
  </li>
  <li>
    You are sharing a journey you were going to make anyway: on a non-profit basis and without
    charging more than a share of the costs.
  </li>
  <li>You follow the traffic rules and are responsible for the driving.</li>
  <li>
    If any of this stops being true, you will stop publishing trips until everything is in order again.
  </li>
</ul>
<p>
  UAL Carpool does not check your licence or your insurance: it relies on your declaration, which is
  stored with its date and version.
</p>
`;

export const VEHICLE_DECLARATION_1_0_EN = `<p>For this vehicle, you declare that:</p>
<ul>
  <li>It has <strong>valid compulsory insurance</strong>.</li>
  <li>It has an <strong>up-to-date MOT (ITV)</strong>, if its age requires one.</li>
  <li>It is roadworthy and you are able to drive it.</li>
  <li>
    If any of this stops being true, you will not publish trips with it until everything is in order
    again.
  </li>
</ul>
<p>
  UAL Carpool does not check the insurance or the MOT: it relies on your declaration, which is stored
  with the vehicle, its date and its version.
</p>
`;

export const LOCATION_1_0_EN = `<p>If you allow us, we use your device's location to:</p>
<ul>
  <li>Fill in where you are leaving from when you search for or publish a trip ("Use my location").</li>
  <li>Suggest going home if you are on campus.</li>
  <li>Show you on the map of a trip in progress where you are in relation to the driver.</li>
</ul>
<p>
  We only use it at that moment: we do not store it or share it with other users. It is based on your
  consent (Article 6(1)(a) GDPR): you can withdraw it whenever you like in My profile → Privacy, and
  the app will keep working if you type in the addresses.
</p>
<p>
  The driver's location during their trip in progress does not depend on this consent: it is part of
  the service (Article 6(1)(b)), as explained in the Privacy policy.
</p>
`;

// Lo común a las versiones 1.1 y 1.2 de la política, hasta el chat
const PRIVACY_INTRO_EN = `<p>Provisional text, pending review.</p>

<h2>In a nutshell</h2>
<ul>
  <li>Your data is only used for shared journeys within the UAL university community.</li>
  <li>
    If you drive, your location is only seen by your passengers (and whoever they choose with the
    live trip link) and only while the trip lasts; the route is deleted when it ends.
  </li>
  <li>We do not sell your data or use it for advertising.</li>
  <li>You can ask to see, correct or delete it whenever you like (see "Your rights").</li>
</ul>

<h2>Controller</h2>
<p>
  University of Almería (contact details and those of the Data Protection Officer pending
  confirmation).
</p>

<h2>What data we process</h2>
<ul>
  <li>
    Account: name, institutional email address, phone number and password (stored encrypted, never in
    plain text).
  </li>
  <li>Public profile: avatar, "About me", travel preferences and the reviews you receive.</li>
  <li>
    Trips: origin, destination, times, seats, vehicle (make, model, licence plate and capacity),
    requests and pickup points.
  </li>
  <li>
    If you drive: your position while the trip is in progress, also with the app in the background
    (see "Driver's location during the trip").
  </li>
  <li>In all other cases, your location only if you give your consent (see "Your location").</li>
  <li>The messages in each trip's chat, read receipts and reports about those chats.</li>
  <li>
    If you turn on push notifications, your device or browser identifier, to send them to you.
  </li>
  <li>Incidents you report and their review.</li>
  <li>A record of your consents (see "Record of consents").</li>
</ul>

<h2>Purposes and legal basis</h2>
<p>
  To manage your account and the shared trips, including the position of whoever drives while the
  trip is in progress: this is necessary to provide you with the service (Article 6(1)(b) GDPR).
  Usage data, without identifying anyone, is used to measure the impact (vehicles avoided) and for
  the project's simulations.
</p>
<p>
  Only for that: we do not use your data for advertising or to build commercial profiles.
</p>

<h2>Driver's location during the trip</h2>
<p>
  To start a trip as a driver you have to share your location: accepted passengers can see where the
  car is and how long it will take, and when you finish, the app checks whether you are near the
  destination. It is part of the service provided (Article 6(1)(b) GDPR), so no separate consent is
  requested, but your device's permission is: without it the trip cannot be started.
</p>
<p>
  The position is sent every few seconds only while the trip is in progress, also with the app in the
  background on mobile, with a visible notice while it is being shared. It stops being sent when the
  trip ends or is cancelled, and the route is deleted then; only how many metres from the
  destination it ended is kept.
</p>

<h2>Your location</h2>
<p>
  In all other cases, the app only uses your location if you give your consent (Article 6(1)(a)
  GDPR) and, in addition, your device's permission. It is used to suggest a nearby origin when you
  search or publish and, if you travel as a passenger, to follow the trip on the map and know whether
  you are already next to the car. Only the point you choose as origin or pickup is sent.
</p>
<p>
  You can withdraw your consent whenever you like in <strong>My profile</strong>, without affecting
  what was processed before. If you remove the permission on your device, the app detects it and
  records it as withdrawn. Without location you can keep using the app by typing in the addresses.
</p>
`;

const PRIVACY_PUSH_AND_SHARE_EN = `<h2>Push notifications</h2>
<p>
  If you turn them on (in <strong>My profile</strong> and with your device or browser permission), we
  let you know about the important things in your trips even when the app is closed: requests,
  accepted or rejected seats, cancelled or started trips and new chat messages. A message
  notification says who has written to you, not what they said. They are sent with Firebase Cloud
  Messaging, a Google service that acts as a data processor and only receives your device identifier
  and the notification. You can turn them off whenever you like in <strong>My profile</strong> or in
  your device settings; turning them off or logging out deletes the identifier.
</p>
`;

const PRIVACY_LIVE_SHARE_EN = `<h2>Sharing the trip live</h2>
<p>
  For your safety, if you travel as a passenger with an accepted seat you can share your trip with
  someone you trust through a secret link that opens without an account. Whoever opens it sees the
  status of the trip (waiting for pickup, in the car or finished), your pickup point and time, the
  destination and the estimated arrival, the driver's first name and their car (make, model, colour
  and licence plate) and, only while the trip is in progress, the car's position and the route on the
  map. They never see phone numbers, other passengers or their pickup points.
</p>
<p>
  It is based on the legitimate interest in passenger safety (Article 6(1)(f) GDPR). If you drive,
  your passengers can share the trip this way, and you can object by writing to us.
</p>
<p>
  The link works from when the seat is accepted. When the trip ends or is cancelled, it stops showing
  the position and the licence plate, and after 24 hours it stops working. You can stop sharing
  whenever you like and the link stops working immediately. We only store a fingerprint of the link,
  never the link itself.
</p>

<h2>Phone verification</h2>
<p>
  To verify your phone we send you an SMS with a one-time code that expires after a few minutes. If
  you change your number, it has to be verified again.
</p>
`;

const PRIVACY_WHO_SEES_START_EN = `<h2>Who sees it</h2>
<ul>
  <li>
    Your public profile is seen by other users when you coincide on a trip or in a search.
  </li>
  <li>
    Your name and phone number are only seen by the driver and the accepted passengers of a trip, and
    by the administration when it reviews an incident.
  </li>
  <li>
    The driver's position during the trip is seen by their accepted passengers and, if a passenger
    shares the trip live, by the person they send the link to (see "Sharing the trip live").
  </li>
  <li>
    The exact origin and destination of a trip are seen by its driver, its accepted passengers and the
    administration; people searching for a trip see them approximately (to within about 500 m) and
    without the route, except for the campus car parks.
  </li>
`;

const PRIVACY_END_EN = `  <li>
    They are not sold or passed on to third parties: the live trip link is sent by the passenger
    themselves to whoever they choose. For push notifications we use Firebase Cloud Messaging
    (Google) as a data processor.
  </li>
</ul>

<h2>Record of consents</h2>
<p>
  We store when you accept the terms of use, when you read this policy and when you give or withdraw
  your location consent: the document and its exact version, a fingerprint of its text, the date,
  where it was done from and a fingerprint that prevents the record from being modified. It serves
  to prove your consent (Article 7(1) GDPR). When we change these texts we let you know in the app
  and, if the change affects what you accepted, we ask you to accept it again.
</p>

<h2>How long</h2>
<p>
  For as long as you have the account. The route of a trip is deleted when it ends or is cancelled.
  Chat messages are deleted 30 days after the trip ends or is cancelled; the copy of a reported
  conversation is kept with its incident for as long as needed to review it.
</p>
<p>
  Deleting your account deactivates it: it is no longer visible, you cannot log in again and your
  consents are withdrawn. Your data is kept blocked, not used for anything else, only to deal with
  possible liabilities (for example, an incident or a claim) during the legal periods; after that it
  is deleted or anonymised. The record of consents is kept as evidence. (Specific periods pending
  agreement with the University.)
</p>

<h2>Your rights</h2>
<p>
  You can request access, rectification, erasure, restriction, portability and objection, and lodge a
  complaint with the Spanish Data Protection Agency (aepd.es).
</p>
<p>
  You can correct your profile and preferences yourself in <strong>My profile</strong>. For anything
  else, write to us from <strong>Help and support</strong>, in <strong>My profile</strong>, with the
  reason "My account": we will reply within one month (Article 12(3) GDPR).
</p>
`;

export const PRIVACY_1_1_EN = `${PRIVACY_INTRO_EN}
<h2>Trip chat</h2>
<p>
  The driver and the accepted passengers of a trip can write to each other in its chat, to arrange
  the pickup, from when there are passengers until 24 hours after the trip. It is part of the service
  (Article 6(1)(b) GDPR). Opening the chat updates your read time, so whoever wrote can tell whether
  everyone has read their message (read receipt). If you find the conversation inappropriate you can
  report it: the administration receives a copy of the conversation and your reason, and nobody on
  the trip knows who reported it.
</p>

${PRIVACY_PUSH_AND_SHARE_EN}
${PRIVACY_LIVE_SHARE_EN}
${PRIVACY_WHO_SEES_START_EN}  <li>
    The messages in a trip's chat are only seen by its driver and its accepted passengers; if the chat
    is reported, also by the administration.
  </li>
${PRIVACY_END_EN}`;

export const PRIVACY_1_1_SUMMARY_EN =
  'We explain that sharing your location as a driver while the trip is in progress is part of the service (the trip cannot be started without it), that location in all other cases is still optional, what happens to your data when you delete your account, how the trip chat works (who sees the messages and when they are deleted), push notifications (optional, with Google Firebase Cloud Messaging) and, at the start, a summary in a nutshell: what we use your data for, that we do not sell it, how to exercise your rights and that, for your safety, as a passenger you can share the trip live with someone you trust.';

export const PRIVACY_1_2_EN = `${PRIVACY_INTRO_EN}
<h2>Trip chat</h2>
<p>
  The driver can write to each accepted passenger in a chat between the two of them (other
  passengers cannot see it), to arrange the pickup, from when there are passengers until 24 hours
  after the trip. When the passenger gets out, that chat becomes read-only. It is part of the service
  (Article 6(1)(b) GDPR). Opening the chat updates your read time, so whoever wrote can tell whether
  the other person has read their message (read receipt). If you find the conversation inappropriate
  you can report it: the administration receives a copy of the conversation and your reason, and
  nobody on the trip knows who reported it.
</p>

${PRIVACY_PUSH_AND_SHARE_EN}
<h2>Trip emails</h2>
<p>
  In addition to your account emails (the code to log in or recover your password), we write to your
  institutional email address at two moments of each trip as a passenger: when your seat is
  confirmed (with the route, the time, the pickup point and who is driving) and when your trip ends
  (with the link to review it within the following 7 days). It is part of the service (Article
  6(1)(b) GDPR) and does not include advertising. They are sent with the service's mail server (the
  University's or a provider acting as a data processor, yet to be decided).
</p>

${PRIVACY_LIVE_SHARE_EN}
${PRIVACY_WHO_SEES_START_EN}  <li>
    The messages in each chat are only seen by the driver and the passenger of that conversation (those
    of the previous shared chat, by its participants); if it is reported, also by the administration.
  </li>
${PRIVACY_END_EN}`;

export const PRIVACY_1_2_SUMMARY_EN =
  'We explain the emails we send you on each trip (when your seat is confirmed and when it ends, with the link to review it) and that the trip chat is direct between whoever drives and each passenger.';
