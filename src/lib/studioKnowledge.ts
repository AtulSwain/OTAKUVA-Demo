/**
 * Canonical Knowledge Dictionary for Japanese Animation Studios
 * Contains structured history, founders, chronological milestones, and studio DNA
 */

export interface StudioFounder {
  name: string;
  role: string;
  slug: string;
  imageUrl?: string;
  bio?: string;
}

export interface StudioMilestone {
  year: number;
  title: string;
  description: string;
  category: 'FOUNDING' | 'MILESTONE' | 'BREAKTHROUGH' | 'EXPANSION' | 'CURRENT';
  relatedAnime?: string;
}

export interface StudioKnowledgeEntry {
  slug: string;
  name: string;
  nativeName?: string;
  foundedYear: number;
  foundedDate: string;
  location: string;
  country: string;
  officialWebsite?: string;
  logoUrl?: string;
  bannerUrl?: string;
  summary: string;
  history: {
    foundingEra: string;
    goldenAge: string;
    modernEra: string;
  };
  founders: StudioFounder[];
  keyPersonnel: StudioFounder[];
  timeline: StudioMilestone[];
  dna: {
    signatureStyle: string;
    primaryGenres: string[];
    artisticPhilosophy: string;
  };
}

export const CANONICAL_STUDIOS: Record<string, StudioKnowledgeEntry> = {
  madhouse: {
    slug: 'madhouse',
    name: 'Madhouse',
    nativeName: '株式会社マッドハウス',
    foundedYear: 1972,
    foundedDate: 'October 17, 1972',
    location: 'Suginami, Tokyo',
    country: 'Japan',
    officialWebsite: 'https://www.madhouse.co.jp/',
    logoUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=120',
    summary:
      'Legendary Japanese animation studio founded by former Mushi Production animators, renowned for prestige psychological thrillers, auteur-driven cinema, and high-octane modern masterpieces.',
    history: {
      foundingEra:
        'Madhouse was founded on October 17, 1972 by former Mushi Production animators Masao Maruyama, Osamu Dezaki, Rintaro, and Yoshiaki Kawajiri following the bankruptcy of Osamu Tezuka\'s studio. In its early years, Madhouse established a reputation for uncompromising animation craft, partnering with Tokyo Movie Shinsha on legendary projects like Aim for the Ace! and Space Adventure Cobra.',
      goldenAge:
        'During the 1990s and 2000s, Madhouse became the global benchmark for mature, cinematic anime. Under Masao Maruyama\'s creative leadership, the studio nurtured visionary director Satoshi Kon—producing Perfect Blue, Millennium Actress, Tokyo Godfathers, and Paprika. Simultaneously, Madhouse delivered definitive adaptations of celebrated manga including Naoki Urasawa\'s Monster, Death Note, Hajime no Ippo, Black Lagoon, and Hunter x Hunter.',
      modernEra:
        'In the modern era, Madhouse continues to set the standard for prestige television animation. The studio produced the viral worldwide sensation One-Punch Man (Season 1), the dark fantasy epic Overlord, and the universally acclaimed 2023 masterpiece Frieren: Beyond Journey\'s End directed by Keiichiro Saito.',
    },
    founders: [
      {
        name: 'Masao Maruyama',
        role: 'Co-Founder & Legendary Producer',
        slug: 'masao-maruyama',
        imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100',
        bio: 'Visionary producer who co-founded Madhouse in 1972 and later founded MAPPA and Studio M2.',
      },
      {
        name: 'Osamu Dezaki',
        role: 'Co-Founder & Auteur Director',
        slug: 'osamu-dezaki',
        imageUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100',
        bio: 'Pioneered signature techniques including dramatic freeze-frames (postcard memories) and split-screen framing.',
      },
      {
        name: 'Rintaro (Shigeyuki Hayashi)',
        role: 'Co-Founder & Director',
        slug: 'rintaro',
        imageUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100',
        bio: 'Directorial pioneer behind Metropolis, Galaxy Express 999, and X/1999.',
      },
      {
        name: 'Yoshiaki Kawajiri',
        role: 'Co-Founder, Director & Animator',
        slug: 'yoshiaki-kawajiri',
        imageUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=100',
        bio: 'Master of stylized action and dark fantasy, director of Ninja Scroll and Vampire Hunter D: Bloodlust.',
      },
    ],
    keyPersonnel: [
      {
        name: 'Satoshi Kon',
        role: 'Legendary Director (In Memoriam)',
        slug: 'satoshi-kon',
        bio: 'Genius director of Perfect Blue, Paprika, Millennium Actress, and Paranoia Agent.',
      },
      {
        name: 'Keiichiro Saito',
        role: 'Director (Frieren: Beyond Journey\'s End)',
        slug: 'keiichiro-saito',
        bio: 'Acclaimed modern director celebrated for Frieren and Bocchi the Rock!.',
      },
    ],
    timeline: [
      {
        year: 1972,
        title: 'Studio Founded',
        description: 'Founded by Masao Maruyama, Osamu Dezaki, Rintaro, and Yoshiaki Kawajiri in Tokyo.',
        category: 'FOUNDING',
      },
      {
        year: 1989,
        title: 'Yawara! A Fashionable Judo Girl',
        description: 'First major long-running television series collaboration with Naoki Urasawa.',
        category: 'MILESTONE',
        relatedAnime: 'Yawara!',
      },
      {
        year: 1993,
        title: 'Ninja Scroll Theatrical Release',
        description: 'Yoshiaki Kawajiri\'s action masterpiece achieves massive international cult status.',
        category: 'BREAKTHROUGH',
        relatedAnime: 'Ninja Scroll',
      },
      {
        year: 1997,
        title: 'Satoshi Kon Directorial Debut: Perfect Blue',
        description: 'Groundbreaking psychological thriller redefines the artistic boundaries of animated cinema.',
        category: 'BREAKTHROUGH',
        relatedAnime: 'Perfect Blue',
      },
      {
        year: 2004,
        title: 'Monster Anime Adaptation',
        description: 'A masterpiece 74-episode psychological suspense magnum opus adapted from Naoki Urasawa\'s manga.',
        category: 'MILESTONE',
        relatedAnime: 'Monster',
      },
      {
        year: 2006,
        title: 'Death Note & Paprika',
        description: 'Global cultural phenomenon Death Note broadcasts alongside Satoshi Kon\'s final film Paprika.',
        category: 'MILESTONE',
        relatedAnime: 'Death Note',
      },
      {
        year: 2011,
        title: 'Hunter x Hunter (2011)',
        description: 'Definitive 148-episode adaptation of Yoshihiro Togashi\'s legendary shonen manga.',
        category: 'MILESTONE',
        relatedAnime: 'Hunter x Hunter (2011)',
      },
      {
        year: 2015,
        title: 'One-Punch Man (Season 1)',
        description: 'Unprecedented sakuga animation showcase assembling the industry\'s greatest freelance talent.',
        category: 'BREAKTHROUGH',
        relatedAnime: 'One-Punch Man',
      },
      {
        year: 2023,
        title: 'Frieren: Beyond Journey\'s End',
        description: 'Critical and commercial triumph ranked as the highest-rated anime series of all time.',
        category: 'CURRENT',
        relatedAnime: 'Frieren: Beyond Journey’s End',
      },
    ],
    dna: {
      signatureStyle: 'High-contrast cinematic framing, psychological tension, dynamic action choreography, and expressive character acting.',
      primaryGenres: ['Psychological', 'Thriller', 'Action', 'Dark Fantasy', 'Mystery'],
      artisticPhilosophy: 'Empowering auteur directors and top-tier animators with complete creative freedom to achieve uncompromising visual storytelling.',
    },
  },

  mappa: {
    slug: 'mappa',
    name: 'MAPPA',
    nativeName: '株式会社MAPPA',
    foundedYear: 2011,
    foundedDate: 'June 14, 2011',
    location: 'Suginami, Tokyo',
    country: 'Japan',
    officialWebsite: 'http://www.mappa.co.jp/',
    logoUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=120',
    summary:
      'Powerhouse animation studio established by Masao Maruyama, celebrated for cutting-edge production scale, visceral action choreography, and blockbuster adaptations.',
    history: {
      foundingEra:
        'MAPPA (Maruyama Animation Produce Project Association) was founded on June 14, 2011 by former Madhouse co-founder and producer Masao Maruyama at age 70. His goal was to create a flexible studio capable of producing ambitious auteur projects like Sunao Katabuchi\'s In This Corner of the World and Shinichiro Watanabe\'s Kids on the Slope.',
      goldenAge:
        'In 2016, Manabu Otsuka assumed the role of CEO, initiating a rapid strategic expansion that positioned MAPPA as the premier studio for high-demand modern shonen and prestige drama. The studio delivered Yuri!!! on Ice, Dororo, Banana Fish, and Vinland Saga Season 2.',
      modernEra:
        'Today, MAPPA stands as one of the most prolific and technically formidable studios in the global industry, handling monumental franchises including Jujutsu Kaisen, Chainsaw Man, Attack on Titan Final Season, and Hell\'s Paradise.',
    },
    founders: [
      {
        name: 'Masao Maruyama',
        role: 'Founder',
        slug: 'masao-maruyama',
        bio: 'Legendary producer who founded MAPPA after 39 years leading Madhouse.',
      },
      {
        name: 'Manabu Otsuka',
        role: 'CEO & Executive Producer',
        slug: 'manabu-otsuka',
        bio: 'Spearheaded MAPPA\'s transformation into a modern global production powerhouse.',
      },
    ],
    keyPersonnel: [
      {
        name: 'Sunao Katabuchi',
        role: 'Director',
        slug: 'sunao-katabuchi',
        bio: 'Director of the award-winning masterpiece In This Corner of the World.',
      },
      {
        name: 'Shota Goshozono',
        role: 'Director',
        slug: 'shota-goshozono',
        bio: 'Visionary director behind Jujutsu Kaisen Season 2 (Shibuya Incident).',
      },
    ],
    timeline: [
      {
        year: 2011,
        title: 'Studio Founded',
        description: 'Founded by Masao Maruyama in Suginami, Tokyo.',
        category: 'FOUNDING',
      },
      {
        year: 2012,
        title: 'Kids on the Slope',
        description: 'Debut television production directed by Shinichiro Watanabe with music by Yoko Kanno.',
        category: 'BREAKTHROUGH',
      },
      {
        year: 2016,
        title: 'Yuri!!! on Ice & In This Corner of the World',
        description: 'Global viral sensation alongside an Academy of Japan prize-winning feature film.',
        category: 'MILESTONE',
      },
      {
        year: 2020,
        title: 'Jujutsu Kaisen Season 1 & Attack on Titan Final Season',
        description: 'MAPPA assumes production of two of the largest anime franchises on Earth.',
        category: 'BREAKTHROUGH',
      },
      {
        year: 2022,
        title: 'Chainsaw Man',
        description: 'Fully self-funded, hyper-cinematic adaptation of Tatsuki Fujimoto\'s manga.',
        category: 'MILESTONE',
      },
      {
        year: 2023,
        title: 'Jujutsu Kaisen: Shibuya Incident & Vinland Saga S2',
        description: 'Sweeping critical acclaim for peak emotional storytelling and groundbreaking action direction.',
        category: 'CURRENT',
      },
    ],
    dna: {
      signatureStyle: 'High-density composite rendering, 3D camera tracking with 2D key animation, cinematic color grading, and heavy impact frames.',
      primaryGenres: ['Action', 'Supernatural', 'Dark Fantasy', 'Drama'],
      artisticPhilosophy: 'Taking on the most challenging, high-intensity projects with cutting-edge compositing and unyielding ambition.',
    },
  },

  ufotable: {
    slug: 'ufotable',
    name: 'ufotable',
    nativeName: 'ユーフォーテーブル有限会社',
    foundedYear: 2000,
    foundedDate: 'October 2000',
    location: 'Suginami, Tokyo',
    country: 'Japan',
    officialWebsite: 'http://www.ufotable.com/',
    logoUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=120',
    summary:
      'Premier animation studio celebrated for industry-leading digital VFX, seamless 3D background integration, dynamic cinematography, and the record-shattering Demon Slayer franchise.',
    history: {
      foundingEra:
        'ufotable was founded in October 2000 by former Telecom Animation Film producer Hikaru Kondo. The studio embraced an integrated in-house digital production workflow from its earliest days, housing animation, 3D CGI, background art, and compositing departments under one roof.',
      goldenAge:
        'In 2007, ufotable partnered with Type-Moon to adapt The Garden of Sinners (Kara no Kyoukai) into a seven-film theatrical series. The visual fidelity revolutionized Japanese animation aesthetics, leading to monumental adaptations of Fate/Zero and Fate/stay night: Unlimited Blade Works.',
      modernEra:
        'In 2019, ufotable released Demon Slayer: Kimetsu no Yaiba. Episode 19 achieved unprecedented global acclaim, and the 2020 feature film Mugen Train shattered all historical box-office records to become the highest-grossing Japanese film in cinema history ($507M worldwide).',
    },
    founders: [
      {
        name: 'Hikaru Kondo',
        role: 'Founder & President',
        slug: 'hikaru-kondo',
        bio: 'Pioneered ufotable\'s integrated digital pipeline and visionary collaboration with Type-Moon.',
      },
    ],
    keyPersonnel: [
      {
        name: 'Haruo Sotozaki',
        role: 'Director',
        slug: 'haruo-sotozaki',
        bio: 'Director of the entire Demon Slayer: Kimetsu no Yaiba anime franchise.',
      },
      {
        name: 'Tomonori Sudou',
        role: 'Director & Character Designer',
        slug: 'tomonori-sudou',
        bio: 'Director of the Fate/stay night: Heaven\'s Feel film trilogy.',
      },
    ],
    timeline: [
      {
        year: 2000,
        title: 'Studio Founded',
        description: 'Founded in Suginami, Tokyo by Hikaru Kondo.',
        category: 'FOUNDING',
      },
      {
        year: 2007,
        title: 'The Garden of Sinners (Kara no Kyoukai)',
        description: 'Seven-part film series establishes ufotable\'s signature digital compositing supremacy.',
        category: 'BREAKTHROUGH',
      },
      {
        year: 2011,
        title: 'Fate/Zero',
        description: 'Prestige dark fantasy epic universally acclaimed for photorealistic lighting and battle direction.',
        category: 'MILESTONE',
      },
      {
        year: 2014,
        title: 'Fate/stay night: Unlimited Blade Works',
        description: 'Television series sets new benchmark for digital VFX and particle rendering in anime.',
        category: 'MILESTONE',
      },
      {
        year: 2019,
        title: 'Demon Slayer: Kimetsu no Yaiba (Ep 19)',
        description: 'The Hinokami dance battle becomes a defining viral milestone in modern pop culture history.',
        category: 'BREAKTHROUGH',
      },
      {
        year: 2020,
        title: 'Mugen Train Box Office World Record',
        description: 'Becomes the #1 highest-grossing Japanese film of all time worldwide ($507 Million).',
        category: 'MILESTONE',
      },
      {
        year: 2024,
        title: 'Infinity Castle Trilogy Announced',
        description: 'Demon Slayer Infinity Castle confirmed as a theatrical trilogy event.',
        category: 'CURRENT',
      },
    ],
    dna: {
      signatureStyle: 'Luminous digital lighting, proprietary 3D CGI camera pans, particle simulations, hand-painted calligraphy VFX, and fluid sword fighting.',
      primaryGenres: ['Action', 'Fantasy', 'Supernatural', 'Historical'],
      artisticPhilosophy: 'Unifying 2D hand-drawn expression with 3D digital technology entirely in-house for seamless visual cohesion.',
    },
  },

  bones: {
    slug: 'bones',
    name: 'Bones',
    nativeName: '株式会社ボンズ',
    foundedYear: 1998,
    foundedDate: 'October 1998',
    location: 'Suginami, Tokyo',
    country: 'Japan',
    officialWebsite: 'https://www.bones.co.jp/',
    logoUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=120',
    summary:
      'Action animation powerhouse founded by former Sunrise staff, celebrated for Fullmetal Alchemist: Brotherhood, Mob Psycho 100, and My Hero Academia.',
    history: {
      foundingEra:
        'Bones was founded in October 1998 by Sunrise producer Masahiko Minami, character designer Toshihiro Kawamoto, and animation director Hiroshi Ousaka following their work on Cowboy Bebop. Their mission was to build a creator-led studio with "bones" (substance and structural strength) dedicated to hand-drawn animation excellence.',
      goldenAge:
        'Throughout the 2000s, Bones produced a succession of timeless masterpieces, including Eureka Seven, Wolf\'s Rain, Soul Eater, and the definitive 2009 anime epic Fullmetal Alchemist: Brotherhood—which held the #1 spot on global ranking databases for over a decade.',
      modernEra:
        'In the modern era, Bones operates five specialized production sub-studios (A, B, C, D, E), powering global blockbusters like My Hero Academia, Bungo Stray Dogs, the jaw-dropping sakuga benchmark Mob Psycho 100, and the cinematic feature Josee, the Tiger and the Fish.',
    },
    founders: [
      {
        name: 'Masahiko Minami',
        role: 'Co-Founder & President',
        slug: 'masahiko-minami',
        bio: 'Legendary producer who led Cowboy Bebop at Sunrise before founding Bones.',
      },
      {
        name: 'Toshihiro Kawamoto',
        role: 'Co-Founder & Character Designer',
        slug: 'toshihiro-kawamoto',
        bio: 'Iconic character designer behind Cowboy Bebop, Wolf\'s Rain, and Noragami.',
      },
      {
        name: 'Hiroshi Ousaka',
        role: 'Co-Founder & Animation Director (In Memoriam)',
        slug: 'hiroshi-ousaka',
        bio: 'Master animator who set Bones\' exacting standards of dynamic movement.',
      },
    ],
    keyPersonnel: [
      {
        name: 'Yasuhiro Irie',
        role: 'Director',
        slug: 'yasuhiro-irie',
        bio: 'Director of Fullmetal Alchemist: Brotherhood.',
      },
      {
        name: 'Yuzuru Tachikawa',
        role: 'Director',
        slug: 'yuzuru-tachikawa',
        bio: 'Director of Mob Psycho 100 and Death Parade.',
      },
    ],
    timeline: [
      {
        year: 1998,
        title: 'Studio Founded',
        description: 'Founded by Masahiko Minami, Toshihiro Kawamoto, and Hiroshi Ousaka.',
        category: 'FOUNDING',
      },
      {
        year: 2001,
        title: 'Cowboy Bebop: Knockin\' on Heaven\'s Door',
        description: 'Co-produced the iconic theatrical movie feature.',
        category: 'BREAKTHROUGH',
      },
      {
        year: 2003,
        title: 'Fullmetal Alchemist (2003) & Wolf\'s Rain',
        description: 'First FMA anime achieves massive global critical and commercial breakthrough.',
        category: 'MILESTONE',
      },
      {
        year: 2005,
        title: 'Eureka Seven',
        description: 'Original mecha and coming-of-age masterwork directed by Tomoki Kyoda.',
        category: 'MILESTONE',
      },
      {
        year: 2009,
        title: 'Fullmetal Alchemist: Brotherhood',
        description: 'Faithful 64-episode adaptation universally regarded as one of the greatest anime ever made.',
        category: 'BREAKTHROUGH',
      },
      {
        year: 2016,
        title: 'My Hero Academia & Mob Psycho 100',
        description: 'Launches two era-defining shonen series with unmatched hand-drawn action animation.',
        category: 'MILESTONE',
      },
      {
        year: 2024,
        title: 'My Hero Academia: Memories & Season 7',
        description: 'Climax of the worldwide superhero saga.',
        category: 'CURRENT',
      },
    ],
    dna: {
      signatureStyle: 'Deformative hand-drawn smears, expressive action choreography, dynamic perspective shifts, and mechanical/anatomical weight.',
      primaryGenres: ['Action', 'Adventure', 'Sci-Fi', 'Supernatural', 'Mecha'],
      artisticPhilosophy: 'Championing pure hand-drawn 2D animation craft with physical impact, emotional resonance, and structural artistic integrity.',
    },
  },

  'wit-studio': {
    slug: 'wit-studio',
    name: 'Wit Studio',
    nativeName: '株式会社ウィットスタジオ',
    foundedYear: 2012,
    foundedDate: 'June 1, 2012',
    location: 'Musashino, Tokyo',
    country: 'Japan',
    officialWebsite: 'https://www.witstudio.co.jp/',
    logoUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=120',
    summary:
      'Acclaimed Tokyo studio founded by IG Port producers, celebrated for the landmark first three seasons of Attack on Titan, Vinland Saga Season 1, Spy x Family, and Ranking of Kings.',
    history: {
      foundingEra:
        'Wit Studio was established on June 1, 2012 by George Wada and Tetsuya Nakatake as a subsidiary of IG Port (Production I.G). The studio made an immediate worldwide impact with its debut full-length TV series, Attack on Titan (2013).',
      goldenAge:
        'Wit Studio\'s work on Attack on Titan Seasons 1–3 redefined 2D action animation with pioneering 3D Maneuver Gear camera work choreographed by Arifumi Imai. The studio subsequently produced the historical Viking epic Vinland Saga (Season 1) and the stylish caper Great Pretender.',
      modernEra:
        'Wit Studio co-produces the worldwide family phenomenon Spy x Family with CloverWorks, and created the critically revered fairytale masterpiece Ranking of Kings (Ousama Ranking) and the upcoming Netflix remake THE ONE PIECE.',
    },
    founders: [
      {
        name: 'George Wada',
        role: 'Co-Founder & President',
        slug: 'george-wada',
        bio: 'Visionary producer who led Wit Studio and now serves as President of Production I.G.',
      },
      {
        name: 'Tetsuya Nakatake',
        role: 'Co-Founder & Producer',
        slug: 'tetsuya-nakatake',
        bio: 'Key production executive behind Attack on Titan, Kabaneri, and Spy x Family.',
      },
    ],
    keyPersonnel: [
      {
        name: 'Tetsuro Araki',
        role: 'Director',
        slug: 'tetsuro-araki',
        bio: 'Director of Attack on Titan (Seasons 1-3), Kabaneri of the Iron Fortress, and Bubble.',
      },
      {
        name: 'Arifumi Imai',
        role: 'Action Animation Director',
        slug: 'arifumi-imai',
        bio: 'Legendary action animator who choreographed Levi vs Beast Titan and ODM gear battles.',
      },
    ],
    timeline: [
      {
        year: 2012,
        title: 'Studio Founded',
        description: 'Founded by George Wada and Tetsuya Nakatake in Musashino, Tokyo.',
        category: 'FOUNDING',
      },
      {
        year: 2013,
        title: 'Attack on Titan (Season 1)',
        description: 'Explosive debut series transforms anime into a mainstream global phenomenon.',
        category: 'BREAKTHROUGH',
      },
      {
        year: 2019,
        title: 'Attack on Titan S3 Part 2 & Vinland Saga S1',
        description: 'Legendary battle of Shiganshina paired with epic Viking historical drama.',
        category: 'MILESTONE',
      },
      {
        year: 2021,
        title: 'Ranking of Kings & Vivy: Fluorite Eye\'s Song',
        description: 'Critical triumphs showcasing storybook art style and original sci-fi storytelling.',
        category: 'MILESTONE',
      },
      {
        year: 2022,
        title: 'Spy x Family Collaboration',
        description: 'Mega-hit co-production with CloverWorks sweeping global rankings.',
        category: 'MILESTONE',
      },
      {
        year: 2024,
        title: 'THE ONE PIECE Announced',
        description: 'Netflix and Wit Studio announce complete new animation adaptation of Eiichiro Oda\'s One Piece.',
        category: 'CURRENT',
      },
    ],
    dna: {
      signatureStyle: 'Thick dynamic character line art (kagenashi/kageari), sweeping 3D background depth, intense cinematic speedlines, and expressive human vulnerability.',
      primaryGenres: ['Action', 'Drama', 'Fantasy', 'Historical', 'Adventure'],
      artisticPhilosophy: 'Delivering visceral kinetic action with profound emotional stakes and handcrafted cinematic polish.',
    },
  },

  'kyoto-animation': {
    slug: 'kyoto-animation',
    name: 'Kyoto Animation',
    nativeName: '株式会社京都アニメーション',
    foundedYear: 1981,
    foundedDate: '1981 (Incorporated July 12, 1985)',
    location: 'Uji, Kyoto',
    country: 'Japan',
    officialWebsite: 'https://www.kyotoanimation.co.jp/',
    logoUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=120',
    summary:
      'Revered Kyoto-based animation studio renowned for unparalleled character acting, breathtaking background artistry, salaried in-house creators, and emotional masterpieces like Violet Evergarden and A Silent Voice.',
    history: {
      foundingEra:
        'Kyoto Animation was founded in 1981 by Yoko Hatta and her husband Hideaki Hatta in Uji, Kyoto. Starting as a coloring studio employing local housewives, KyoAni developed a revolutionary in-house training school and salaried employment model that guaranteed unprecedented continuity of craft.',
      goldenAge:
        'In the 2000s, KyoAni redefined modern anime with The Melancholy of Haruhi Suzumiya, Lucky Star, Clannad, and K-On!—sparking global cultural phenomena with its photorealistic background lighting and delicate character mannerisms.',
      modernEra:
        'In recent years, KyoAni produced the visually transcendent Violet Evergarden and the critically acclaimed feature A Silent Voice (Koe no Katachi). Following the tragic 2019 arson attack, the studio\'s resilient return with Sound! Euphonium 3 and Miss Kobayashi\'s Dragon Maid S stands as a testament to the enduring power of creative community.',
    },
    founders: [
      {
        name: 'Yoko Hatta',
        role: 'Co-Founder & Vice President',
        slug: 'yoko-hatta',
        bio: 'Co-founded the studio and instituted KyoAni\'s human-centered production philosophy.',
      },
      {
        name: 'Hideaki Hatta',
        role: 'Co-Founder & President',
        slug: 'hideaki-hatta',
        bio: 'Executive leader who built Kyoto Animation into the world\'s most respected independent studio.',
      },
    ],
    keyPersonnel: [
      {
        name: 'Naoko Yamada',
        role: 'Director',
        slug: 'naoko-yamada',
        bio: 'Visionary director of A Silent Voice, K-On!, and Liz and the Blue Bird.',
      },
      {
        name: 'Taichi Ishidate',
        role: 'Director',
        slug: 'taichi-ishidate',
        bio: 'Director of Violet Evergarden and Beyond the Boundary.',
      },
    ],
    timeline: [
      {
        year: 1981,
        title: 'Studio Founded in Kyoto',
        description: 'Founded by Yoko and Hideaki Hatta as an independent animation collective.',
        category: 'FOUNDING',
      },
      {
        year: 2006,
        title: 'The Melancholy of Haruhi Suzumiya',
        description: 'Hare Hare Yukai dance and nonlinear broadcast creates a global anime culture phenomenon.',
        category: 'BREAKTHROUGH',
      },
      {
        year: 2008,
        title: 'Clannad: After Story',
        description: 'Key visual novel adaptation universally celebrated as an emotional masterpiece.',
        category: 'MILESTONE',
      },
      {
        year: 2016,
        title: 'A Silent Voice (Koe no Katachi)',
        description: 'Naoko Yamada\'s poignant feature film achieves global critical acclaim.',
        category: 'BREAKTHROUGH',
      },
      {
        year: 2018,
        title: 'Violet Evergarden',
        description: 'Sets a new historical apex for television animation detail, character acting, and orchestral score.',
        category: 'MILESTONE',
      },
      {
        year: 2024,
        title: 'Sound! Euphonium 3 (Final Movement)',
        description: 'Triumphant culmination of Kumiko Oumae\'s high school concert band journey.',
        category: 'CURRENT',
      },
    ],
    dna: {
      signatureStyle: 'Subtle micro-expressions, photorealistic depth of field, gentle lens flare lighting, exquisite cloth and hair physics, and empathetic character body language.',
      primaryGenres: ['Drama', 'Slice of Life', 'Romance', 'Music', 'Fantasy'],
      artisticPhilosophy: '100% salaried in-house staff, humane working conditions, and an unwavering commitment to portraying the quiet beauty of the human heart.',
    },
  },

  'studio-ghibli': {
    slug: 'studio-ghibli',
    name: 'Studio Ghibli',
    nativeName: '株式会社スタジオジブリ',
    foundedYear: 1985,
    foundedDate: 'June 15, 1985',
    location: 'Koganei, Tokyo',
    country: 'Japan',
    officialWebsite: 'https://www.ghibli.jp/',
    logoUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=120',
    summary:
      'World-renowned animated film studio founded by Hayao Miyazaki, Isao Takahata, and Toshio Suzuki, creators of Academy Award-winning classics Spirited Away and The Boy and the Heron.',
    history: {
      foundingEra:
        'Studio Ghibli was founded on June 15, 1985 by directors Hayao Miyazaki and Isao Takahata and producer Toshio Suzuki following the critical and box-office triumph of Nausicaä of the Valley of the Wind (1984).',
      goldenAge:
        'Over four decades, Ghibli produced an unbroken string of cinema masterpieces including Castle in the Sky, My Neighbor Totoro, Grave of the Fireflies, Princess Mononoke, and Spirited Away (which won the Academy Award for Best Animated Feature in 2003).',
      modernEra:
        'In 2024, Hayao Miyazaki\'s semi-autobiographical fantasy The Boy and the Heron won the Academy Award for Best Animated Feature, reaffirming Studio Ghibli\'s status as the crown jewel of international animation.',
    },
    founders: [
      {
        name: 'Hayao Miyazaki',
        role: 'Co-Founder & Master Director',
        slug: 'hayao-miyazaki',
        bio: 'Legendary two-time Academy Award-winning director of Spirited Away, Princess Mononoke, and Totoro.',
      },
      {
        name: 'Isao Takahata',
        role: 'Co-Founder & Director (In Memoriam)',
        slug: 'isao-takahata',
        bio: 'Master director of Grave of the Fireflies, Only Yesterday, and The Tale of the Princess Kaguya.',
      },
      {
        name: 'Toshio Suzuki',
        role: 'Co-Founder & Producer',
        slug: 'toshio-suzuki',
        bio: 'Producer who orchestrated Studio Ghibli\'s creative and commercial legacy.',
      },
    ],
    keyPersonnel: [
      {
        name: 'Joe Hisaishi',
        role: 'Legendary Composer',
        slug: 'joe-hisaishi',
        bio: 'Iconic musical genius behind the unforgettable orchestral scores of all major Miyazaki films.',
      },
    ],
    timeline: [
      {
        year: 1985,
        title: 'Studio Founded',
        description: 'Founded by Hayao Miyazaki, Isao Takahata, and Toshio Suzuki.',
        category: 'FOUNDING',
      },
      {
        year: 1988,
        title: 'My Neighbor Totoro & Grave of the Fireflies',
        description: 'Historic double-feature release establishes Ghibli\'s cultural supremacy.',
        category: 'BREAKTHROUGH',
      },
      {
        year: 1997,
        title: 'Princess Mononoke',
        description: 'Epic environmental fantasy breaks all Japanese all-time box office records.',
        category: 'MILESTONE',
      },
      {
        year: 2001,
        title: 'Spirited Away (Academy Award Winner)',
        description: 'Wins the Oscar for Best Animated Feature and Golden Bear at Berlin Film Festival.',
        category: 'BREAKTHROUGH',
      },
      {
        year: 2013,
        title: 'The Wind Rises & The Tale of the Princess Kaguya',
        description: 'Simultaneous masterpieces from Miyazaki and Takahata.',
        category: 'MILESTONE',
      },
      {
        year: 2024,
        title: 'The Boy and the Heron Academy Award',
        description: 'Hayao Miyazaki wins his second Academy Award for Best Animated Feature.',
        category: 'CURRENT',
      },
    ],
    dna: {
      signatureStyle: 'Lush hand-painted watercolor backgrounds, joyful character flight animations, environmental reverence, culinary warmth, and gentle silence (Ma).',
      primaryGenres: ['Fantasy', 'Adventure', 'Historical', 'Drama'],
      artisticPhilosophy: 'Creating handcrafted cinema that celebrates the wonder of nature, human resilience, and the quiet magic of everyday existence.',
    },
  },
};

/**
 * Returns canonical knowledge for a studio, with smart fallback generation for any database studio
 */
export function getStudioKnowledge(slugOrName: string): StudioKnowledgeEntry | null {
  const normalized = slugOrName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  if (CANONICAL_STUDIOS[normalized]) {
    return CANONICAL_STUDIOS[normalized];
  }

  // Check name aliases
  for (const [key, entry] of Object.entries(CANONICAL_STUDIOS)) {
    if (
      entry.name.toLowerCase().includes(slugOrName.toLowerCase()) ||
      slugOrName.toLowerCase().includes(entry.name.toLowerCase()) ||
      normalized.includes(key)
    ) {
      return entry;
    }
  }

  return null;
}
