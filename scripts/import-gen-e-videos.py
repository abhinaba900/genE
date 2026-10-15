"""
Imports gen.E's own short films from the official YouTube channel
(https://www.youtube.com/@gen.e_media/shorts) into seed data for the CMS (`npm run seed`).

For each video listed in STORIES it:
  1. reads the title, description, upload date, duration and tags,
  2. downloads the original into .media-cache/ (git-ignored; metadata is kept there,
     the large original is deleted after encoding unless --keep-cache),
  3. transcodes a web-friendly 720x1280 H.264/AAC copy with fast-start
     -> public/media/video/<slug>.mp4
  4. extracts a poster frame and two stills
     -> public/media/posters/<slug>.jpg, public/media/images/<slug>-1.jpg / -2.jpg
  5. writes scripts/seed-data/gen-e-videos.json, which `npm run seed` imports into the CMS.

Requirements: Python 3.10+, `pip install yt-dlp pillow numpy`, ffmpeg on PATH, Node.js on PATH
(used by yt-dlp to solve YouTube's player JavaScript).

Usage:  python scripts/import-gen-e-videos.py            (skips files that already exist)
        python scripts/import-gen-e-videos.py --frames   (re-pick posters and stills only)
        python scripts/import-gen-e-videos.py --force    (re-download and re-encode everything)
        --keep-cache keeps the full-size originals in .media-cache/ (otherwise deleted after encoding)
        --cookies-from-browser=firefox   use your signed-in browser if YouTube asks to "confirm you're not a bot"
        --cookies=path/to/cookies.txt    same, with an exported cookies file

When the CMS exists, editors upload these films directly and this script is retired.
"""
import io, json, os, random, re, shutil, subprocess, sys, tempfile, time, unicodedata, urllib.request
from datetime import datetime, timezone

import numpy as np
from PIL import Image

import yt_dlp

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
CACHE = os.path.join(ROOT, ".media-cache")
VIDEO_DIR = os.path.join(ROOT, "public", "media", "video")
POSTER_DIR = os.path.join(ROOT, "public", "media", "posters")
IMAGE_DIR = os.path.join(ROOT, "public", "media", "images")
OUT_JSON = os.path.join(ROOT, "scripts", "seed-data", "gen-e-videos.json")

# (YouTube id, category slug, featured) — newest first, as listed on the channel.
STORIES = [
    ("MFdfQXh7Kx8", "cities-and-living", True),  # What is Rurban Livng? Organo Antharam in Hyderabad
    ("1gEed24ebrU", "innovation", True),  # Indian startup can help you lay home foundation in just one day and wi
    ("fhO5JFnsXf0", "environment", True),  # India has a high fever and El Nino is to blame
    ("RUsjEdeEBZs", "waste-and-recycling", False),  # Indian startup turns plastic waste into wood - unWOOD
    ("wZaZmq5r4_4", "society", False),  # Why Indian men should learn to talk about periods
    ("SpKFsDOWg-o", "cities-and-living", False),  # Inside Bengaluru's Airport Terminal in a Garden - T2
    ("NLPYQLo5HcQ", "mobility", False),  # This viral truck is driving across North India to deliver sustainabili
    ("vshlJalhAjs", "society", False),  # Is bioscience the career of tomorrow? - The Next Gene 2026 by Masters'
    ("fy5cbCkFBq8", "innovation", False),  # An Indian startup made a device that can help you detect heart problem
    ("KHs0TOV3_dM", "waste-and-recycling", False),  # This place is where India finds out how to turn waste into wealth - IF
    ("22Ds1zRQRqM", "environment", False),  # This company is turning landfills back into landscapes
    ("0u369t73mT8", "waste-and-recycling", False),  # An Aadhaar card for garbage - Indian startup builds digital identity s
    ("y0X9xzBbS5A", "waste-and-recycling", False),  # Indian startup makes walls out of recycled paper - HEDRAD
    ("HtBFO-V6kxU", "cities-and-living", False),  # Sustainability meets slow living in Hyderabad - Organo
    ("oZE5cH7CtQI", "mobility", False),  # CNG scooter vs EV Scooter - TVS Jupiter CNG /Hybrid - The world's firs
    ("caKMZXoDVUw", "innovation", False),  # Making drinking water free of microplastics, pesticides and uranium
    ("9PqbmesLX4o", "waste-and-recycling", False),  # India's largest trade fair for waste, water, sewage and recycling - IF
    ("hvDJP_PvbeM", "innovation", False),  # Hyderabad startup is using AI to get you fit and healthy at home - POR
    ("fcpirCv6ANA", "environment", False),  # This city in Tamil Nadu is using roads to save water instead of wastin
    ("NgOcKHHcp-g", "environment", False),  # Engineer builds a forest on a terrace in the middle of Bengaluru city
    ("7wFusOf8_QY", "energy", False),  # How Delhi Airport functions with solar energy
    ("bh91Ga9ZAvE", "innovation", False),  # Underwear that's good for you and the planet - Mad Minimalist Organic
    ("92PTj7Z1WLY", "society", False),  # A pet cemetery in Bangalore
    ("82HwqARGVgo", "energy", False),  # A man built a 1km long solar super factory in Nagpur
    ("sTsIIXZT5Bk", "food-and-farming", False),  # Found Indias newest chai wala - Chaiomi
    ("NeRDmAggvNA", "waste-and-recycling", False),  # This Indian company is using landfill waste to make furniture and inte
    ("Kld51GHLxo8", "innovation", False),  # Hyderabad startup making space robots to clear space junk - Cosmoserve
    ("o-cSjtIVYbM", "society", False),  # Saving Jharkhand's Paitkar Art - Amadubi Art Village
    ("DXFexxFtwZ8", "waste-and-recycling", False),  # Gujarat designer turns old clothes into bricks - RINFICO
    ("EZhH_yth7nY", "innovation", False),  # Spoons and forks that you can eat - Trishula India
    ("1_GrbH0KZm8", "waste-and-recycling", False),  # Chennai startup is making blocks from M-sand waste that are strong eno
    ("3TYxIr_slpY", "innovation", False),  # This machine is saving millions of litres of oil and lubricants - Mini
    ("ufUJHrcBAQw", "waste-and-recycling", False),  # Helping make jeans and t-shirts from banana waste -  Gencrest
    ("wnnsUTFg220", "innovation", False),  # Made in India robots that can work with humans - Perceptyne from Hyder
    ("hLeH7-qSUjQ", "waste-and-recycling", False),  # This startup is fixing India's biggest waste problem - Trace
    ("_WIi-s2IuwA", "waste-and-recycling", False),  # Building homes with bamboo, sugarcane and cotton waste - Bamboocrete
    ("Otm6LPSVgwc", "mobility", False),  # What India's auto rickshaws could look like in the future - Hyundai an
    ("K7nI-TJ7Zpc", "energy", False),  # Hyderabad startup finds a way to reduce AC bills in offices, malls, te
    ("dS-9hL_cPRk", "innovation", False),  # Hyderabad startup is giving safety equipment an upgrade, with ACs with
    ("kUi7-eVN-88", "waste-and-recycling", False),  # This venture is recycling hotel linens like bedsheets and towels in In
    ("lB-O_TNvsBA", "waste-and-recycling", False),  # This food delivery packaging is made with paper - Ecobyte by ITC Packa
    ("Xl_O985fHZY", "environment", False),  # How India's textile city cleaned up - Tirupur in Tamil Nadu
    ("xUhpFU7ifjI", "society", False),  # Tips to get investment from Nithin Kamath's Rainmatter Capital - Clima
    ("B2j7UqdRN6E", "cities-and-living", False),  # What a low-density living space looks like in Bengaluru (Sarjapur) - T
    ("kmB8oeV0PfI", "environment", False),  # This simple filter can give you thousands of litres of water for free
    ("pyfwBHxcZfI", "waste-and-recycling", False),  # This startup in India is making zero waste lifestyle possible - Bare N
    ("REPiKYdAYEI", "waste-and-recycling", False),  # This venture is turning old clothes into new bags and more - The Good
    ("VbxdHzbSXTI", "waste-and-recycling", False),  # Why is Ikea India is buying back furniture in Hyderabad ? Ikea Buy Bac
    ("Uh5qzg98g4A", "waste-and-recycling", False),  # Turning plastic waste into planters - Sereno Lifestyle
    ("jYaX3ISzXVE", "innovation", False),  # This Indian startup is taking India's sustainable kitchenware and vess
    ("G6AFEs6f_S4", "food-and-farming", False),  # A special food delivery by Zomato - Project ZEAL
    ("gwGELiZG0sg", "cities-and-living", False),  # A company from India is making luxurious, sustainable Mongolian homes
    ("1JKVspvx1N0", "cities-and-living", False),  # This startup built a platform to help build sustainable buildings and
    ("cVNxtruaaA8", "environment", False),  # This man is on a mission to recharge Bengaluru's groundwater
    ("SWvIJMrOick", "environment", False),  # The wild hospital in Bengaluru - PFA
    ("OcuzMu1g8FY", "environment", False),  # How lakes are saving Bengaluru
    ("o9aeeTAyqok", "waste-and-recycling", False),  # This Indian startup is replacing plastic in the travel industry - Amwo
    ("AdeEbLjilaE", "environment", False),  # How can Japanese forests save Indian cities? -Miyawaki
    ("DmfLJrnCHVw", "environment", False),  # Leopard vs Bengaluru - The man fighting to save the original kings of
    ("BpcPdv3J8gU", "environment", False),  # Meet the man who created a 1500sqft forest in Bengaluru
    ("ukxzqUPlT98", "waste-and-recycling", False),  # This company is keeping our food free from microplastics - Dinearth Ba
    ("LCJ82lhtmAM", "mobility", False),  # Why is India making EVs noisy?
    ("I3hWW5y6eG8", "energy", False),  # This Expo Is Powering Indias Clean Energy Future - The Smarter E India
    ("y0MZNymtqjE", "innovation", False),  # Inside iPhones secret durability lab in Singapore
    ("frhv2SxjEoc", "mobility", False),  # Accelerating India's EV drive - EVready 2026 is Karnataka's largest EV
    ("kfPkBo7TFJc", "food-and-farming", False),  # Budget Cafe with 10 rupee tea at Indian Airports - Udan Yatri Cafe
    ("VtPRLOXGRhc", "waste-and-recycling", False),  # All you need to know about Ooty's plastic ban, the fines and the water
    ("gKjTwZ2ywMk", "energy", False),  # The big business of Renewable Energy in India - Renewable Energy Expo
    ("NT5_SvleZZc", "waste-and-recycling", False),  # A company from Kerala made India's 1st 100% biodegradable plastic bott
    ("nHjb4-JP-PE", "waste-and-recycling", False),  # Plastic-free and biodegradable sanitary pads from India - Papaya Pads
    ("rELtQEjrYuk", "food-and-farming", False),  # Natural farmlands that you can own in Hyderabad - Farm Natura
    ("QNfmZ0fkLlM", "waste-and-recycling", False),  # This company makes eco-friendly packaging for fruits and vegetables -
    ("kEy2nV6hbRo", "energy", False),  # Bengaluru company installing solar which is as easy as getting an inte
    ("HjjOfBgBJGQ", "society", False),  # Why government schools in Bengaluru's Electronics City are better
    ("1O9-nXwjpKY", "mobility", False),  # How a cycling race is helping change Pune in India - Bajaj Pune Grand
    ("rEB39wr3iXk", "waste-and-recycling", False),  # A company from Karnataka is changing our food delivery packaging to be
    ("hpsP2if7-Vc", "waste-and-recycling", False),  # Startup in India provides eco-friendly packaging made from banana and
    ("C6JOGCoSxoY", "cities-and-living", False),  # The eco-friendly villa retreat with the best view in Karnataka -  Vare
    ("sf-ti0mUHqg", "food-and-farming", False),  # Investing in nature through managed farmlands - Hosachiguru in Bengalu
    ("KhEa8_T884Q", "environment", False),  # Indian startup can turn sewage water into clean water that is good eno
    ("GyDI8C2D1Z4", "waste-and-recycling", False),  # Indian startup recycling old shoes for a good cause - Greensole Founda
    ("ks97vtoPe_w", "innovation", False),  # The AI device you can wear - OMI AI
    ("VQ1tf6GwMms", "waste-and-recycling", False),  # Indian startup is making leather from Banana waste - Recore
    ("O0ci12H1wGQ", "mobility", False),  # EV and CNG Trucks - tippers and trailers that are charging India's pol
    ("umqmyJ8z1-o", "cities-and-living", False),  # The sustainable finds at Ikea India for sustainable living
    ("OjbGafBcFuA", "cities-and-living", False),  # The smart and sustainable home lifts from India - Nibav Home lift
    ("978lkeoOPFE", "society", False),  # The Indian toy town making eco-friendly toys - Channapatna in Karnatak
    ("QIkdtqgtTT8", "waste-and-recycling", False),  # Indian scientist discovers way to make straws from coffee waste withou
    ("HiTAMUd5lvY", "cities-and-living", False),  # How India is moving towards a net zero and green building future - Gre
    ("8GJtHD24jl8", "innovation", False),  # Meet Keo - India's low cost AI-powered computer for just 18,999
    ("BTZMwVi8xoY", "waste-and-recycling", False),  # This Indian startup is building a world without any waste - Dia Mirza
    ("ZEExnvz4RKs", "society", False),  # The Tech Summit that built India's silicon valley - Bengaluru Tech Sum
    ("nUN9qPPBdgA", "waste-and-recycling", False),  # Business ideas that are helping India turn its waste into wealth - Bha
    ("AEbq-TQSlKE", "waste-and-recycling", False),  # The big business of India's plastic recycling - Plastics Recycling Sho
    ("9OAVll0oCVU", "waste-and-recycling", False),  # How this Hyderabad company recycles construction and demolition waste
    ("E6f4RmPuIp8", "waste-and-recycling", False),  # Sustainable shoes in India made from recycled materials like tennis ba
    ("eeWizWvz31g", "waste-and-recycling", False),  # This 100 crore T-shirt empire was created from plastic waste - Ecoline
    ("QsyMsfJXovk", "society", False),  # The story behind the startup pitch by Bengaluru kids who went viral -
    ("CJQVg6FPpgY", "society", False),  # Why period underwear is better than sanitary pads - MAHINA Period Pant
    ("09_OpFW1J74", "mobility", False),  # How this startup trying to make India's intercity bus travel better an
    ("ssSV7iRL4O8", "waste-and-recycling", False),  # This startup took India's e-waste and turned it into a 400 crore empir
    ("ZTZU1lap-mQ", "waste-and-recycling", False),  # Eco-friendly straws made from grass that can replace plastic straws in
    ("DxZZm_brUpo", "cities-and-living", False),  # Why this area in Bengaluru, India is cleaner than the rest of the city
    ("LIHN_EzONQM", "mobility", False),  # How TATA Motors is making public transport smoother and sustainable wi
    ("IFcLdPqHVpo", "society", False),  # Jharkhand's tribal art that is fading away - Sohrai Art from India
    ("31uHVNM7IBs", "cities-and-living", False),  # Creating forest living communities in Hyderabad - Woods Shamshabad by
    ("ZZR3hQmBNBk", "environment", False),  # These little devices can save thousands of litres of water in Indian h
    ("fZofjL_AluU", "waste-and-recycling", False),  # This is the future of green tech and sustainable businesses - IFAT Ind
    ("3TLAuL9wjZw", "energy", False),  # Indian EV startup makes portable power backup system for solar energy
    ("T7FDo7Sz1uU", "food-and-farming", False),  # What is Tempeh, the plant based whole food that is packed with protein
    ("Ov1-Z6ZClko", "waste-and-recycling", False),  # How this Art of Living Ashram in India is recycling waste in value
    ("mC7Xy8MTS_4", "waste-and-recycling", False),  # Indian startup making cloth diapers to replace disposable diapers made
    ("qCvB1a142lA", "energy", False),  # What is digital solar and how it could change the way we get solar in
    ("elO71OeRqew", "innovation", False),  # How India uses dried leaves to make eco-friendly plates - Envome Areca
    ("JT0ZuiBKWSU", "innovation", False),  # Sustainable shoes for Indian feet - Impakto Barefoot Shoes
    ("vN3lLXX3B54", "innovation", False),  # This Indian startup is turning Bamboo into 'green gold' - Amwoodo
    ("okv5yV9ggIM", "environment", False),  # The Indian man who made the world's most affordable water filter - Nir
    ("l75u0JPWgDo", "waste-and-recycling", False),  # Indian startup making jeans from banana and sarees from pineapple wast
    ("eH-bCRebfUM", "waste-and-recycling", False),  # How Indian startups are rescripting the future with recycled paper - R
    ("CdU2goWseQ0", "cities-and-living", False),  # Villas in Bengaluru that converse with nature through biophilic archit
    ("JA3QwGYYIsE", "waste-and-recycling", False),  # Turning plastic waste into clothes and upcycling textile waste into pr
    ("eninJ-opamM", "mobility", False),  # EV BAZAAR 2025 in Bengaluru India - How ZOMATO and BLINKIT are working
    ("UbhesHJOJo4", "food-and-farming", False),  # The Netflix for fruits and vegetables in  India - Farmizen
    ("ezH2JyDK9Vk", "waste-and-recycling", False),  # The Indian scientists making enzymes that can make plastic disappear -
    ("5lJVngDcLnM", "food-and-farming", False),  # How to make paneer that is high on protein and low on fat
    ("vvGCl7BbPN8", "cities-and-living", False),  # Sustainable Villa Community in Bengaluru | Paradise on Earth by Urbanr
    ("V__mOGTEG9Q", "cities-and-living", False),  # A resort near Bangalore that blends with nature - Amanvana Spa Resort
    ("jMj0Xi8giOE", "food-and-farming", False),  # How this startup is taking India's healthy Jamuns to the world - Triba
    ("BZW7cEhpRRk", "waste-and-recycling", False),  # How sugarcane waste is replacing plastic for food packaging in India -
    ("mWPl0jWWekU", "mobility", False),  # Bicycle subscription for kids and adults that helps reduce cycle waste
    ("Y7vbrWpk57Q", "society", False),  # How a saree almost died and is now being revived in Udupi Karnataka |
    ("zsWYyV8hCBg", "society", False),  # He fell & broke his spine, now he is breaking barriers with ramps - Ra
    ("Q37UsPxLF2k", "cities-and-living", False),  # Inside the most sustainable office in Bangalore - TITAN office near El
    ("IEbztX9cO84", "environment", False),  # Why this Indian village marks the birth of a girl child with 111 trees
    ("rC4L2dTikfM", "mobility", False),  # India's flying electric taxi |  Sarla Aviation wants to change the way
    ("y-f4piqKXl4", "waste-and-recycling", False),  # From phones to cars - how lithium ion batteries are recycled in India
    ("zs5yGPUjO-k", "mobility", False),  # This Indian car runs on Solar | Eva Car by @vayvemobility  for just  3
    ("1B9vgLclWyE", "environment", False),  # A real solution to Delhi's air pollution | Dharasksha Ecosolution
    ("Rwop31nJy6U", "waste-and-recycling", False),  # Turning cloth waste into supermodels | Eco-friendly mannequins from In
    ("JtKrH5Xi0t8", "food-and-farming", False),  # The farmer who lost 6 cr and then built a 1000 cr company | India's la
    ("96ANEgnUoVk", "society", False),  # Fixing the gender imbalance in India's startup ecosystem | @NSRCELIIMB
    ("97fjwjphvDg", "waste-and-recycling", False),  # Making paper from jeans, beer and coffee waste | Tree Free Paper | Blu
    ("0jSwFyJCSDc", "waste-and-recycling", False),  # Turning paper waste into notebooks | Paper recycling in Pune for a goo
    ("aOXLUZNd1LY", "energy", False),  # All you need to know about getting solar for your home | Subsidy for s
    ("2aUf07q9uig", "mobility", False),  # Turn petrol scooter into electric | Starya Mobility in Bangalore helps
    ("-CI75HMW5k4", "food-and-farming", False),  # How drip irrigation system is saving the world | Jain Irrigation from
    ("e4knmIPdVH0", "waste-and-recycling", False),  # Is there plastic in your chewing gum?| Gud Gum Plastic-free Gum  chewi
    ("XRk4BE_v-qg", "waste-and-recycling", False),  # This startup from India is looking to fix our packaging | Plastic-free
    ("kiUDneuVxcc", "innovation", False),  # These clothes from India don't stain or smell | SMART FASHION worn by
    ("baalzbDCnnw", "environment", False),  # The machine in India that makes water from the sun and the air | Akvos
    ("IPZ2QtxGZsc", "food-and-farming", False),  # How a fruit bar could save India 90,000 crore | Barefruit | Raheja Sol
    ("DAunDeYmNkM", "energy", False),  # How a small problem became an Indian solar empire | The @Emmvee_Group
    ("-EGSc2cZTf4", "waste-and-recycling", False),  # The Indian professor reinventing straws | Sunbird Cocount Straws  star
    ("v-apBb4pqlA", "waste-and-recycling", False),  # How a wife's idea created a 30 crore company in India| PACKMATE PAPER
    ("I7okqeMGe5M", "food-and-farming", False),  # World's Biggest Plant Factory | Jain HI-TECH Plant Factory in India| T
    ("q9LhUNfQnAo", "waste-and-recycling", False),  # Pashupati Group | The 1000 crore recycling empire  |  How India recycl
    ("_ATOzLHTIRY", "waste-and-recycling", False),  # Zomatos Genius Plan to Reduce Plastic from Food Delivery!  ZomatoPacka
    ("TBueYdPhKW4", "cities-and-living", False),  # Building with Earth Blocks | Eco-friendly bricks in India | Mud Blocks
    ("Mkl_0E5dFrY", "environment", False),  # How India's step wells can help in water conservation  waterconservati
]

# Small editorial fixes to source titles (typos only — wording is the client's).
TITLE_FIXES = {"MFdfQXh7Kx8": "What is Rurban Living? Organo Antharam in Hyderabad"}

# Channel-level SEO tags that say nothing about the individual story.
GENERIC_TAG = re.compile(
    r"gen ?\.? ?e|generation earth|srishti|sris[ .]?e\b|anchor|presenter|host|influencer|"
    r"content (creator|india)|sustainable stor|sustainability$|eco friendly",
    re.I,
)

W, H = 720, 1280
PAUSE_SECONDS = (4, 9)
STOPWORDS = {"a", "an", "and", "at", "for", "from", "in", "into", "of", "on", "or", "the", "to", "with", "s"}


def slugify(text, max_len=64):
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    text = re.sub(r"[^a-zA-Z0-9]+", "-", text.split(" - ")[0]).strip("-").lower()
    if len(text) > max_len:
        text = text[:max_len].rsplit("-", 1)[0]
    # Don't end a truncated slug on a dangling small word ("…instead-of").
    words = text.split("-")
    while len(words) > 3 and words[-1] in STOPWORDS:
        words.pop()
    return "-".join(words)


def clean_description(text):
    text = re.sub(r"https?://\S+", "", text)
    text = re.sub(r"(?<![\w])[@#]([\w.\-]+)", r"\1", text)  # @handle / #tag -> plain words
    paras = [re.sub(r"\s+", " ", p).strip() for p in re.split(r"\n\s*\n|\n", text)]
    return [p for p in paras if p and not re.match(r"^register\b", p, re.I)]


def ffmpeg(*args):
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *args], check=True)


def frame_score(path):
    """Sharp frames score high; frames with burned-in caption words mid-screen score low."""
    g = np.asarray(Image.open(path).convert("L"), dtype=np.float32)
    rgb = np.asarray(Image.open(path).convert("RGB"), dtype=np.int16)
    lap = g[1:-1, 1:-1] * 4 - g[:-2, 1:-1] - g[2:, 1:-1] - g[1:-1, :-2] - g[1:-1, 2:]
    sharpness = float(lap.var())
    h = rgb.shape[0]
    band = rgb[int(h * 0.40) : int(h * 0.66)]
    # Caption text: near-white, unsaturated pixels concentrated in the middle band.
    white = (band.min(axis=2) > 225) & ((band.max(axis=2) - band.min(axis=2)) < 18)
    caption = float(white.mean())
    return sharpness * (1 - min(caption * 18, 0.95))


def youtube_cover(vid, out):
    """The Short's own vertical cover from YouTube's image CDN. Returns False if unavailable."""
    for name in ("oar2", "oardefault"):
        try:
            with urllib.request.urlopen(f"https://i.ytimg.com/vi/{vid}/{name}.jpg", timeout=20) as r:
                im = Image.open(io.BytesIO(r.read())).convert("RGB")
        except Exception:
            continue
        if im.height > im.width:
            im.resize((W, H), Image.LANCZOS).save(out, quality=84, optimize=True, progressive=True)
            return True
    return False


def best_frame(video, start, end, out, step=0.25):
    """Sample frames between `start` and `end` seconds and keep the best-scoring one."""
    with tempfile.TemporaryDirectory() as tmp:
        ffmpeg("-ss", f"{start:.2f}", "-t", f"{end - start:.2f}", "-i", video,
               "-vf", f"fps={1 / step}", "-q:v", "3", os.path.join(tmp, "f%03d.jpg"))
        frames = sorted(os.listdir(tmp))
        best = max(frames, key=lambda f: frame_score(os.path.join(tmp, f)))
        shutil.copyfile(os.path.join(tmp, best), out)


def polite_pause():
    """YouTube throttles bursts of requests; space them out."""
    time.sleep(random.uniform(*PAUSE_SECONDS))


def write_json(records):
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=2)


def main():
    force = "--force" in sys.argv
    repick_frames = "--frames" in sys.argv
    keep_cache = "--keep-cache" in sys.argv
    for d in (CACHE, VIDEO_DIR, POSTER_DIR, IMAGE_DIR):
        os.makedirs(d, exist_ok=True)

    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "js_runtimes": {"node": {}},
        "format": "bv*[vcodec^=avc1][height<=1920]+ba[ext=m4a]/bv*[height<=1920]+ba/b",
        "merge_output_format": "mp4",
        "outtmpl": os.path.join(CACHE, "%(id)s.%(ext)s"),
    }
    # If YouTube shows "Sign in to confirm you're not a bot", run with your own signed-in
    # browser session (--cookies-from-browser firefox|chrome|edge) or an exported cookies.txt.
    for arg in sys.argv[1:]:
        if arg.startswith("--cookies-from-browser="):
            ydl_opts["cookiesfrombrowser"] = (arg.split("=", 1)[1],)
        elif arg.startswith("--cookies="):
            ydl_opts["cookiefile"] = arg.split("=", 1)[1]
    records, failures, used_slugs = [], [], set()
    bot_walls = 0
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        for n, (vid, category, featured) in enumerate(STORIES, 1):
            url = f"https://www.youtube.com/shorts/{vid}"
            cached = os.path.join(CACHE, f"{vid}.mp4")
            info_path = os.path.join(CACHE, f"{vid}.info.json")
            try:
                # Metadata is cached so re-runs don't hit YouTube (it rate-limits quickly).
                if os.path.exists(info_path):
                    with open(info_path, encoding="utf-8") as f:
                        info = json.load(f)
                else:
                    polite_pause()
                    info = ydl.sanitize_info(ydl.extract_info(url, download=False))
                    with open(info_path, "w", encoding="utf-8") as f:
                        json.dump(info, f)

                title = TITLE_FIXES.get(vid, info["title"]).strip()
                slug = slugify(title)
                if slug in used_slugs:
                    slug = f"{slug}-{vid[:4].lower()}"
                used_slugs.add(slug)
                duration = float(info.get("duration") or 0)

                video_out = os.path.join(VIDEO_DIR, f"{slug}.mp4")
                if force or not os.path.exists(video_out):
                    if not os.path.exists(cached):
                        polite_pause()
                        print(f"[{n}/{len(STORIES)}] download {vid}", flush=True)
                        ydl.download([url])
                    print(f"[{n}/{len(STORIES)}] encode {slug}", flush=True)
                    ffmpeg(
                        "-i", cached,
                        "-vf", f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},fps=30",
                        "-c:v", "libx264", "-profile:v", "high", "-preset", "slow", "-crf", "28",
                        "-maxrate", "1400k", "-bufsize", "2800k", "-pix_fmt", "yuv420p",
                        "-c:a", "aac", "-b:a", "112k", "-ac", "2", "-movflags", "+faststart",
                        video_out,
                    )
                    if not keep_cache:
                        os.remove(cached)  # originals are large; metadata stays cached

                # Poster = the Short's YouTube cover; stills = clean, sharp frames from the film.
                poster = os.path.join(POSTER_DIR, f"{slug}.jpg")
                frames = {
                    poster: (0.3, 8.0),
                    os.path.join(IMAGE_DIR, f"{slug}-1.jpg"): (duration * 0.30, duration * 0.45),
                    os.path.join(IMAGE_DIR, f"{slug}-2.jpg"): (duration * 0.60, duration * 0.75),
                }
                for path, (start, end) in frames.items():
                    if force or repick_frames or not os.path.exists(path):
                        if path == poster and youtube_cover(vid, path):
                            continue
                        best_frame(video_out, start, end, path)
                bot_walls = 0
            except Exception as err:  # keep going; report at the end
                message = str(err).splitlines()[0][:160]
                failures.append((vid, message))
                print(f"[{n}/{len(STORIES)}] FAILED {vid}: {message}", flush=True)
                if "not a bot" in message or "Sign in" in message:
                    bot_walls += 1
                    if bot_walls >= 3:
                        print(
                            "YouTube is asking for sign-in; stopping. Re-run later, or add "
                            "--cookies-from-browser=firefox (see the docstring) to resume.",
                            flush=True,
                        )
                        break
                continue

            ts = info.get("timestamp")
            published = (
                datetime.fromtimestamp(ts, timezone.utc)
                if ts
                else datetime.strptime(info["upload_date"], "%Y%m%d").replace(hour=6, tzinfo=timezone.utc)
            )
            tags = [t.lower() for t in (info.get("tags") or []) if not GENERIC_TAG.search(t)]
            records.append({
                "youtubeId": vid,
                "slug": slug,
                "title": title,
                "paragraphs": clean_description(info.get("description") or ""),
                "publishedAt": published.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "duration": round(duration, 1),
                "tags": list(dict.fromkeys(tags))[:8],
                "category": category,
                "featured": featured,
                "sourceUrl": url,
            })
            write_json(records)  # save progress after every film

    write_json(records)
    print(f"wrote {len(records)} stories -> {os.path.relpath(OUT_JSON, ROOT)}")
    if failures:
        print(f"{len(failures)} failed (re-run to retry):")
        for vid, message in failures:
            print(f"  {vid}: {message}")


if __name__ == "__main__":
    main()
