// Fixed facts about the residence (from the owner's listing). Prices and experiences live in the database.
export const ROOMS = [
  { name: "Bedroom 1", beds: "King-size bed", note: "Quiet room with a large wardrobe", photo: "/photos/king.webp" },
  { name: "Bedroom 2", beds: "2 twin beds", note: "Nile view · private balcony", photo: "/photos/twin_window.webp" },
  { name: "Bedroom 3", beds: "2 twin beds", note: "Nile view · French balcony", photo: "/photos/twin_wide.webp" },
];

export const AMENITIES: [string, string][] = [
  ["wifi", "Wi-Fi"], ["ac", "Air conditioning in every bedroom"], ["tv", "TV in every bedroom"], ["wash", "Washing machine"],
  ["kitchen", "Open-plan kitchen"], ["bath", "One shared bathroom"], ["lift", "Modern building with elevator"], ["cart", "Al Raya supermarket next to the building"],
  ["pin", "Cafés, restaurants, pharmacy & ATM nearby"], ["ship", "Nile cruise docks close by"],
];

export const GALLERY = [
  { src: "/photos/twin_wide.webp", alt: "Twin bedroom with Nile view and balcony door" },
  { src: "/photos/king.webp", alt: "King-size bedroom" },
  { src: "/photos/balcony.webp", alt: "Balcony looking over the Nile and the west bank" },
  { src: "/photos/desk_mirror.webp", alt: "Desk, mirror and TV in the bedroom" },
  { src: "/photos/feluccas.webp", alt: "Feluccas on the Nile seen from the residence" },
  { src: "/photos/twin_doorway.webp", alt: "Twin bedroom seen from the door" },
  { src: "/photos/king_room.webp", alt: "King bedroom with wardrobe and TV" },
  { src: "/photos/twin_door.webp", alt: "Twin beds with air conditioning" },
  { src: "/photos/westbank.webp", alt: "The green west bank across the river" },
  { src: "/photos/dome.webp", alt: "View from the building over the Nile and the dunes" },
  { src: "/photos/panorama.webp", alt: "Panorama of the Nile, Elephantine and the west bank hills" },
  { src: "/photos/wardrobe.webp", alt: "Three-door wardrobe" },
  { src: "/photos/sheer_wardrobe.webp", alt: "Curtains and balcony door" },
  { src: "/photos/mirror_window.webp", alt: "Bedroom window with sheer curtains" },
  { src: "/photos/curtains_tv.webp", alt: "Blackout curtains and wall TV" },
  { src: "/photos/cruise.webp", alt: "Nile cruise boats moored near the residence" },
];

export const FAQ: [string, string][] = [
  ["Is it the whole apartment?", "Yes. You book the entire 120 m² apartment — three bedrooms, the living area and kitchen are all yours. Nobody else stays there during your booking."],
  ["How do I pay?", "You pay a deposit to hold your dates (by InstaPay or bank transfer), and the rest when you arrive. If you prefer, you can talk to us on WhatsApp first and we'll hold your dates for a day."],
  ["What does \"local price\" mean?", "We book felucca captains, drivers and guides we know personally, at the prices locals pay — not the tourist price you get offered on the street. You pay us; we arrange everything."],
  ["Can you pick us up from the airport or train station?", "Yes. Add the pickup when you book and tell us your flight or train time. Your driver waits for you with your name."],
  ["We're joining a Nile cruise. Is this a good place to stay?", "It's ideal. Several cruise docks are a few minutes away. Many guests stay a night or two before or after their cruise, and we drop you at your boat."],
  ["What time is check-in and check-out?", "Check-in is from the afternoon and check-out is by midday — exact times are on your booking page. Ask us if you need to arrive early or leave late."],
];

export const CATEGORY_LABEL: Record<string, string> = { nile: "On the Nile", temples: "Temples", nubian: "Nubian culture", transfers: "Transfers", food: "Food" };
