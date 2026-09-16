// Word lists for "Name as many as you can", and the check that decides whether
// an answer belongs to the category.
//
// Without this, anything typed or heard was counted: "iPhone" as an animal,
// "pond" as a bird. The count is what the person sees and what is kept, so it
// has to be honest. An answer only counts when it is on the category's list.
//
// The check is forgiving where it can be without letting wrong answers in:
//  - plurals and "a", "the", "um" are ignored ("the ducks" is duck)
//  - describing words are fine ("big brown bear" is bear)
//  - one spoken line can hold several answers ("robin sparrow and eagle")
//  - a misspelling is never counted by itself. Capsule offers the nearest
//    answer ("Did you mean parakeet?") and counts it only if the person taps
//    it. Guessing on their behalf once counted real words that were wrong:
//    "current" as currant, "blunder" as blender.
//
// The lists are generous on purpose. When a real answer is missing, the
// message says Capsule does not know it, never that the person was wrong.

const words = (s) => s.split(/[,\n]/).map((w) => w.trim()).filter(Boolean);

const BIRDS = words(`
albatross, auk, avocet, bald eagle, bantam, barn owl, barnacle goose, bee eater, bittern, black swan,
blackbird, blackcap, blue heron, blue jay, blue tit, bluebird, bobolink, bobwhite, booby, bowerbird,
brambling, brent goose, budgerigar, budgie, bullfinch, bunting, bushtit, bustard, buzzard, canada goose,
canary, capercaillie, cardinal, cassowary, catbird, chaffinch, chick, chickadee, chicken, chiffchaff,
chough, coal tit, cockatiel, cockatoo, cockerel, condor, conure, coot, cormorant, corncrake, coucal,
cowbird, crake, crane, crossbill, crow, cuckoo, curlew, dickcissel, dipper, dodo, dotterel, dove, duck,
duckling, dunlin, dunnock, eagle, eagle owl, egret, eider, emu, falcon, finch, fish eagle, flamingo,
flycatcher, frigatebird, fulmar, gadwall, galah, gallinule, gannet, gnatcatcher, godwit, goldcrest,
golden eagle, goldeneye, goldfinch, goose, goshawk, gosling, grackle, great blue heron, great horned owl,
great tit, grebe, greenfinch, greylag, grosbeak, grouse, guillemot, guinea fowl, gull, gyrfalcon,
harpy eagle, harrier, hawfinch, hawk, hen, heron, hoatzin, hobby, hoopoe, hornbill, horned owl,
house martin, hummingbird, ibis, jacana, jackdaw, jay, junco, kakapo, kea, kestrel, killdeer,
kingfisher, kinglet, kite, kittiwake, kiwi, knot, kookaburra, lapwing, lark, limpkin, linnet,
long tailed tit, loon, lorikeet, lovebird, lyrebird, macaw, magpie, mallard, mandarin duck, marabou,
martin, meadowlark, merganser, merlin, mockingbird, moorhen, motmot, muscovy duck, mute swan, myna,
mynah, night heron, nightingale, nightjar, nuthatch, oriole, osprey, ostrich, owl, oystercatcher,
parakeet, parrot, partridge, parula, peacock, peafowl, peahen, pelican, penguin, peregrine,
peregrine falcon, petrel, phalarope, pheasant, pigeon, pintail, pipit, plover, pochard,
prairie chicken, ptarmigan, puffin, quail, quetzal, rail, raven, razorbill, red kite, redpoll,
redstart, redwing, rhea, roadrunner, robin, roller, rook, rooster, rosella, sage grouse, sanderling,
sandpiper, sapsucker, scaup, screech owl, sea eagle, seagull, secretary bird, shag, shearwater,
shelduck, shoebill, shoveler, shrike, siskin, skua, skylark, snipe, snow goose, snowy egret, snowy owl,
song thrush, songbird, sparrow, sparrowhawk, spoonbill, starling, stilt, stonechat, stork, sunbird,
swallow, swan, swift, tanager, tawny owl, teal, tern, thrasher, thrush, tit, toucan, towhee,
treecreeper, trogon, tropicbird, turkey, turkey vulture, turnstone, turtle dove, twite, verdin, vireo,
vulture, wagtail, warbler, waxwing, weaver, weaver bird, wheatear, whimbrel, whinchat, whippoorwill,
whistling duck, whooper swan, wigeon, wild turkey, wood duck, wood pigeon, woodcock, woodpecker,
woodpigeon, wren, yellowhammer, african grey, kingbird, phoebe, pewee, grassquit, bird of paradise,
cockatoo, wader, heron, hen harrier, marsh harrier, barn swallow, sand martin, swiftlet, frogmouth
`);

const SEA_CREATURES = words(`
anchovy, anemone, angelfish, barnacle, barracuda, bass, beluga, betta, blowfish, bluegill, bream,
carp, catfish, char, chub, clam, clownfish, cockle, cod, coral, crab, crappie, crawfish, crayfish,
cuttlefish, dace, dogfish, dolphin, dugong, eel, flounder, goldfish, great white shark, grouper,
gudgeon, guppy, haddock, hake, halibut, hermit crab, herring, jellyfish, killer whale, kipper, koi,
krill, lamprey, limpet, lobster, mackerel, manatee, manta ray, marlin, minnow, molly, monkfish,
moray eel, mullet, mussel, narwhal, nautilus, octopus, orca, oyster, perch, periwinkle, pike,
pilchard, piranha, plaice, pollock, porpoise, prawn, pufferfish, rainbow trout, ray, roach, rudd,
sailfish, salmon, sardine, scallop, sea anemone, sea bass, sea cucumber, sea horse, sea lion,
sea otter, sea snake, sea star, sea turtle, sea urchin, seahorse, seal, shark, shrimp, skate,
snapper, sole, sponge, sprat, squid, starfish, stickleback, stingray, sturgeon, sunfish, swordfish,
tench, tetra, tilapia, trout, tuna, turbot, walleye, walrus, whale, whelk, whitebait, whiting,
winkle, zander, blue whale, humpback whale, humpback, sperm whale, hammerhead, basking shark,
tiger shark, whale shark, lugworm, sand eel, razor clam, cod fish
`);

const ANIMALS = words(`
aardvark, aardwolf, adder, alligator, alpaca, anaconda, ant, anteater, antelope, ape, aphid,
arctic fox, armadillo, ass, axolotl, baboon, badger, bandicoot, bat, beagle, bear, beaver, bee,
beetle, beluga, bighorn, billy goat, bison, black bear, boa, boar, bobcat, bongo, bonobo, boxer,
brown bear, buck, buffalo, bug, bull, bulldog, bullock, bumblebee, bunny, butterfly, calf, camel,
capuchin, capybara, caracal, caribou, cat, caterpillar, cattle, centipede, chameleon, chamois,
cheetah, chihuahua, chimp, chimpanzee, chinchilla, chipmunk, cicada, clouded leopard, cobra,
cockroach, collie, colt, corgi, cougar, cow, coyote, cricket, crocodile, cub, dachshund, dalmatian,
damselfly, deer, dingo, dinosaur, doe, dog, donkey, dormouse, dragonfly, dromedary, earthworm, earwig,
echidna, eland, elephant, elk, ermine, ewe, fawn, fennec, ferret, filly, firefly, fish, flea, fly,
foal, fox, frog, gaur, gazelle, gecko, gerbil, german shepherd, gibbon, giraffe, glow worm, gnat,
gnu, goat, golden retriever, gopher, gorilla, grass snake, grasshopper, great dane, greyhound,
grizzly bear, groundhog, guanaco, guinea pig, hamster, hare, hedgehog, heifer, hippo, hippopotamus,
hog, honey badger, honeybee, hornet, horse, hound, howler monkey, husky, hyena, hyrax, ibex, iguana,
impala, insect, jack russell, jackal, jaguar, jaguarundi, jerboa, kangaroo, kid, kitten, kitty,
koala, komodo dragon, kudu, labrador, ladybird, ladybug, lamb, lemming, lemur, leopard, lion,
lizard, llama, locust, louse, lynx, macaque, mamba, mammoth, mandrill, mantis, mare, marmoset,
marmot, marten, mastiff, meerkat, midge, millipede, mink, mole, mongoose, monkey, moose, mosquito,
moth, mouflon, mountain goat, mouse, muntjac, mule, musk ox, muskrat, nanny goat, newt, numbat,
ocelot, okapi, opossum, orangutan, oryx, otter, ox, panda, pangolin, panther, pig, piglet,
pika, pine marten, platypus, polar bear, polecat, pomeranian, pony, poodle, porcupine, possum,
praying mantis, prairie dog, pug, puma, pup, puppy, python, quokka, rabbit, raccoon, ram, rat,
rattlesnake, red deer, red panda, reindeer, retriever, rhino, rhinoceros, roe deer, rottweiler,
salamander, schnauzer, scorpion, serval, sheep, sheepdog, shih tzu, shrew, siamese, skunk, sloth,
slug, snail, snake, snow leopard, sow, spaniel, spider, springbok, squirrel, stag, stallion,
stick insect, stoat, sugar glider, tabby, tadpole, tamarin, tapir, tarantula, tasmanian devil,
termite, terrapin, terrier, tick, tiger, toad, tortoise, turtle, tyrannosaurus, t rex, vicuna,
viper, vole, wallaby, walrus, wapiti, warthog, wasp, water buffalo, weasel, weevil, whippet,
wildebeest, wolf, wolverine, wombat, worm, yak, zebra, zebu, alsatian, persian cat, moggy, lab,
hedgehog, kitten, lion cub, bird, gorilla, elephant seal, fruit bat, vampire bat, dragon
`);

const FRUITS_VEG = words(`
acai, apple, apricot, avocado, banana, bilberry, blackberry, blackcurrant, blood orange, blueberry,
boysenberry, breadfruit, cantaloupe, cape gooseberry, cherry, clementine, cloudberry, coconut,
crab apple, cranberry, currant, custard apple, damson, date, dragon fruit, durian, elderberry,
feijoa, fig, goji berry, gooseberry, grape, grapefruit, greengage, guava, honeydew, honeydew melon,
huckleberry, jackfruit, jujube, kiwano, kiwi, kiwi fruit, kumquat, lemon, lime, lingonberry,
loganberry, longan, lychee, mandarin, mango, mangosteen, marionberry, medlar, melon, mulberry,
nectarine, olive, orange, papaya, passion fruit, pawpaw, peach, pear, persimmon, physalis, pineapple,
plantain, plum, pomegranate, pomelo, prune, quince, raisin, rambutan, raspberry, redcurrant, rhubarb,
sapodilla, satsuma, sloe, soursop, star fruit, strawberry, sultana, tamarind, tangerine, tomato,
ugli fruit, watermelon, cherry tomato, grapes, berry, granny smith, bramley,
artichoke, arugula, asparagus, aubergine, bamboo shoot, bean, bean sprout, beet, beetroot,
bell pepper, black bean, bok choy, broad bean, broccoli, broccolini, brussels sprout, butter bean,
butternut squash, cabbage, capsicum, carrot, cassava, cauliflower, celeriac, celery, chard, chickpea,
chicory, chili, chili pepper, chilli, chive, collard greens, collards, corn, corn on the cob, cos,
courgette, cress, cucumber, daikon, dandelion greens, edamame, eggplant, endive, fennel, french bean,
garlic, gherkin, ginger, green bean, horseradish, iceberg lettuce, jalapeno, jicama, kale,
kidney bean, kohlrabi, leek, lentil, lettuce, lima bean, lotus root, maize, mangetout, marrow,
mushroom, mustard greens, okra, onion, pak choi, parsnip, pea, pepper, pickle, potato, pumpkin,
radish, red cabbage, red onion, rocket, romaine, romanesco, runner bean, rutabaga, salsify,
samphire, savoy cabbage, scallion, shallot, snow pea, sorrel, soybean, spinach, spring onion,
sprout, spud, squash, string bean, sugar snap, swede, sweet potato, sweetcorn, swiss chard, taro,
tomatillo, turnip, water chestnut, watercress, yam, yuca, zucchini, green pepper, red pepper,
yellow pepper, new potato, baby corn, pea pod, greens, salad, lettuce leaf,
parsley, basil, mint, coriander, cilantro, dill, almond, walnut, peanut, cashew, chestnut, hazelnut,
pecan, pistachio, macadamia, brazil nut, drumstick, bitter gourd, bottle gourd, gourd, karela,
bhindi, brinjal, lady finger, moringa, jackfruit, amla, chikoo, custard apple, guava, sapota
`);

const SANDWICH = words(`
bread, white bread, brown bread, wholemeal, granary, rye, rye bread, sourdough, roll, bread roll, bun,
bap, baguette, bagel, pitta, pita, wrap, tortilla, croissant, ciabatta, focaccia, toast, naan,
cheese, cheddar, swiss cheese, brie, camembert, mozzarella, parmesan, feta, gouda, edam, stilton,
wensleydale, red leicester, double gloucester, cream cheese, cottage cheese, provolone, emmental,
gruyere, halloumi, goat cheese, goats cheese, blue cheese, american cheese, pepper jack,
monterey jack, cheese slice, paneer,
ham, turkey, chicken, beef, roast beef, corned beef, pastrami, salami, pepperoni, chorizo, prosciutto,
bacon, sausage, hot dog, spam, luncheon meat, bologna, baloney, meatball, pork, pulled pork, lamb,
meatloaf, roast chicken, chicken tikka, coronation chicken, chicken salad, mince, burger, hamburger,
patty, veggie burger, stuffing, pate, liver pate, liverwurst, fish paste, meat paste, paste,
tuna, tuna mayo, salmon, smoked salmon, sardine, prawn, shrimp, crab, crab stick, fish finger,
fish, fish cake, anchovy, mackerel,
egg, fried egg, boiled egg, egg mayonnaise, egg mayo, egg salad, egg and cress, tofu, falafel, hummus,
houmous, guacamole, coleslaw, sauerkraut, kimchi, baked beans, beans,
butter, margarine, mayonnaise, mayo, mustard, ketchup, tomato sauce, brown sauce, hp sauce, relish,
chutney, branston, branston pickle, piccalilli, salad cream, dressing, ranch, thousand island,
bbq sauce, barbecue sauce, hot sauce, sriracha, pesto, aioli, mint sauce, cranberry sauce, gravy,
salt, oil, vinegar, peanut butter, jam, jelly, marmalade, honey, nutella, chocolate spread, marmite,
vegemite, lemon curd, marshmallow fluff, fluff, cream, crisps, chips, potato chips, fries,
french fries, chip, sandwich spread, mustard and cress, alfalfa, herbs, chocolate, sugar,
cinnamon, nuts, blt, club, cucumber sandwich, cheese and pickle, ham salad, cheese and onion,
chutney, green chutney, mint chutney, butter chicken, keema, aloo, potato, avocado toast
`);

const KITCHEN = words(`
kettle, toaster, oven, stove, cooker, hob, microwave, fridge, refrigerator, freezer, fridge freezer,
chest freezer, dishwasher, sink, kitchen sink, tap, faucet, cupboard, cabinet, drawer, counter,
countertop, worktop, table, kitchen table, chair, stool, bar stool, pan, frying pan, saucepan, pot,
wok, skillet, casserole dish, casserole, roasting tin, roasting pan, baking tray, baking sheet,
cake tin, muffin tin, loaf tin, pie dish, teapot, coffee pot, coffee maker, coffee machine,
cafetiere, french press, percolator, mug, cup, saucer, teacup, glass, tumbler, wine glass, jug,
pitcher, plate, bowl, dish, platter, knife, fork, spoon, teaspoon, tablespoon, dessert spoon, ladle,
spatula, whisk, grater, peeler, potato peeler, masher, potato masher, colander, sieve, strainer,
rolling pin, chopping board, cutting board, bread board, bread bin, bread box, bread knife,
can opener, tin opener, bottle opener, corkscrew, tongs, scissors, garlic press, pestle, mortar,
pestle and mortar, measuring jug, measuring cup, measuring spoon, scales, weighing scales,
kitchen scales, timer, egg timer, kitchen timer, oven glove, oven mitt, pot holder, apron,
tea towel, dish towel, dishcloth, sponge, scourer, washing up liquid, dish soap, washing up bowl,
draining board, dish rack, drying rack, bin, trash can, garbage can, rubbish bin, pedal bin,
compost bin, recycling bin, bin bag, mop, broom, bucket, dustpan, dustpan and brush, brush,
blender, food processor, mixer, stand mixer, hand mixer, juicer, slow cooker, crock pot,
pressure cooker, air fryer, deep fat fryer, fryer, rice cooker, waffle iron, sandwich maker,
toastie maker, grill, griddle, cling film, plastic wrap, tin foil, aluminium foil, aluminum foil, foil,
baking paper, parchment, greaseproof paper, kitchen roll, paper towel, napkin, serviette,
tablecloth, placemat, coaster, tray, salt, salt shaker, pepper mill, pepper grinder, pepper pot,
cruet, sugar bowl, butter dish, spice rack, spice, jar, tin, can, tupperware, container, lunchbox,
lunch box, thermos, flask, bottle, cookbook, recipe book, recipe, calendar, clock, kitchen clock,
radio, window, blind, curtain, light, lamp, extractor fan, cooker hood, range, aga, range cooker,
larder, pantry, ice cube tray, ice, fridge magnet, magnet, bread maker, egg cup, cake stand,
biscuit tin, cookie jar, cutlery, crockery, utensil, chopsticks, skewer, baster, funnel, zester,
mandoline, cleaver, carving knife, steak knife, knife sharpener, sharpener, knife block,
wooden spoon, slotted spoon, fish slice, pizza cutter, ice cream scoop, nutcracker, pastry brush,
cookie cutter, piping bag, gravy boat, toast rack, tea caddy, tea bag, sugar tongs, jelly mould,
ramekin, dutch oven, stockpot, steamer, water filter, dishwasher tablet, rubber gloves, gloves,
oven cleaner, bleach, stove top, burner, gas, hotplate, food, fruit bowl, vegetable rack,
washing machine, tumble dryer, fan, fire extinguisher, smoke alarm, cat bowl, dog bowl, pet bowl,
highchair, high chair, tiffin, tiffin box, pressure pan, tawa, kadai, karahi, idli maker, rolling board,
chakla, belan, masala box, spice box, mixie, grinder, coffee grinder, milk, egg, flour, sugar,
tea, coffee, cereal, rice, pasta, noodles, oil, olive oil, vinegar, bread, cheese, butter, jam,
honey, cake, biscuit, cookie, pie, soup, stock, gravy, water, cooking oil, spices, herbs, dal, lentils,
cornflakes, porridge, oats, yoghurt, yogurt, cream, ketchup, sauce, sauces, tinned food, cans
`);

const WEAR = words(`
shirt, t shirt, tshirt, tee, blouse, top, tank top, vest, vest top, crop top, jumper, sweater,
pullover, cardigan, sweatshirt, hoodie, hoody, fleece, jacket, coat, overcoat, raincoat, mac, anorak,
parka, blazer, suit, waistcoat, tuxedo, dinner jacket, dress, gown, evening gown, wedding dress,
sundress, skirt, kilt, trousers, pants, jeans, slacks, chinos, shorts, leggings, tights, stockings,
socks, sock, underwear, knickers, briefs, boxers, boxer shorts, bra, slip, petticoat, nightie,
nightgown, nightdress, pyjamas, pajamas, dressing gown, robe, bathrobe, slippers, shoe, shoes,
boot, boots, wellies, wellingtons, wellington boots, sandals, sandal, flip flops, flip flop,
trainers, sneakers, plimsolls, loafers, brogues, high heels, heels, stilettos, pumps, clogs,
moccasins, espadrilles, hat, cap, baseball cap, beanie, bobble hat, beret, bonnet, sun hat,
straw hat, top hat, bowler hat, bowler, trilby, fedora, flat cap, cowboy hat, helmet, hood,
balaclava, headscarf, scarf, shawl, stole, wrap, poncho, cape, cloak, gloves, glove, mittens,
mitten, tie, bow tie, cravat, belt, braces, suspenders, apron, overalls, dungarees, jumpsuit,
onesie, uniform, swimsuit, swimming costume, bathing suit, bikini, trunks, swimming trunks, wetsuit,
tracksuit, joggers, sweatpants, leotard, tutu, sari, saree, kimono, kaftan, turban, veil, hijab,
burqa, dhoti, kurta, salwar, salwar kameez, lehenga, sarong, dupatta, sherwani, lungi, churidar,
earrings, earring, necklace, bracelet, bangle, ring, wedding ring, engagement ring, watch,
wristwatch, brooch, pendant, locket, chain, anklet, cufflinks, tiara, crown, glasses, spectacles,
sunglasses, reading glasses, contact lenses, hearing aid, wig, hairband, headband, hair clip,
hair tie, scrunchie, bobby pin, hairpin, handbag, purse, backpack, rucksack, bag, mask, face mask,
ear muffs, earmuffs, lipstick, makeup, perfume, aftershave, nail polish, garter, corset, bodice,
camisole, polo shirt, rugby shirt, jersey, football shirt, gilet, bodywarmer, duffle coat,
trench coat, pea coat, fur coat, bomber jacket, leather jacket, denim jacket, windbreaker, cagoule,
snow boots, ski jacket, ski pants, thermals, long johns, tunic, smock, pinafore, bib, nappy, diaper,
babygro, romper, bootees, pinny, collar, lanyard, badge, name badge, medal, rosary, tie pin,
bandana, snood, neck warmer, leg warmers, legwarmers, cummerbund, sash, visor, goggles, knee pads,
shin pads, gaiters, spurs, clothes, outfit, cardi, sweats, dressing gown, lab coat, housecoat,
bindi, nose ring, toe ring, mangalsutra, anklets, watch strap, sports bra, running shoes,
walking boots, hiking boots, work boots, steel toe boots, slip on shoes, mary janes, flats,
ballet flats, wedges, platform shoes, mules, crocs, sliders, slides
`);

const FLOWERS_TREES = words(`
rose, tulip, daffodil, daisy, sunflower, lily, orchid, carnation, chrysanthemum, mum, dahlia, peony,
poppy, pansy, violet, viola, primrose, bluebell, snowdrop, crocus, hyacinth, iris, lavender, lilac,
marigold, geranium, petunia, begonia, fuchsia, hydrangea, azalea, rhododendron, camellia,
magnolia, jasmine, honeysuckle, clematis, wisteria, foxglove, forget me not, buttercup, dandelion,
clover, cornflower, cosmos, zinnia, aster, gerbera, freesia, gladiolus, gladioli, lupin, lupine,
delphinium, larkspur, snapdragon, sweet pea, stock, wallflower, hollyhock, heather,
lily of the valley, anemone, ranunculus, gardenia, hibiscus, bougainvillea, frangipani, lotus,
water lily, amaryllis, poinsettia, protea, bird of paradise, calla lily, tiger lily, edelweiss,
thistle, nasturtium, alyssum, lobelia, impatiens, busy lizzie, verbena, salvia, phlox, cyclamen,
oleander, primula, cowslip, periwinkle, morning glory, black eyed susan, coneflower, echinacea,
yarrow, sedum, hellebore, christmas rose, aquilegia, columbine, scabious, sweet william, pinks,
dianthus, forsythia, camomile, chamomile, heartsease, candytuft, statice, gypsophila,
babys breath, marguerite, cineraria, calendula, agapanthus, allium, crocosmia, montbretia,
red hot poker, gazania, osteospermum, bleeding heart, trillium, harebell, saxifrage, speedwell,
veronica, campanula, bellflower, blossom, cherry blossom, apple blossom, orange blossom, ivy, fern,
cactus, holly, mistletoe, bamboo, heather, gorse, broom, buddleia, lilac, jasmine, marigold,
mogra, rajnigandha, champa, parijat, tuberose, nightshade, bluebonnet, goldenrod, sagebrush,
oak, ash, beech, birch, silver birch, elm, maple, sugar maple, japanese maple, sycamore, chestnut,
horse chestnut, sweet chestnut, conker tree, willow, weeping willow, pussy willow, poplar, aspen,
alder, hazel, hawthorn, blackthorn, rowan, mountain ash, yew, pine, scots pine, fir, douglas fir,
spruce, cedar, larch, cypress, juniper, redwood, sequoia, giant sequoia, monkey puzzle, palm,
coconut palm, date palm, eucalyptus, gum tree, acacia, baobab, banyan, fig, olive, apple, pear,
cherry, plum, orange, lemon, peach, apricot, walnut, pecan, almond, hickory, dogwood, jacaranda,
mimosa, laburnum, lime, linden, plane, london plane, hornbeam, elder, crab apple, mulberry,
tulip tree, catalpa, ginkgo, teak, mahogany, ebony, rosewood, balsa, rubber tree, cork oak, kapok,
mango, neem, peepal, pipal, bodhi tree, tamarind, gulmohar, sandalwood, sal, cottonwood, hemlock,
tamarack, sassafras, buckeye, locust, black locust, honey locust, sweetgum, sourwood, persimmon,
bonsai, christmas tree, whitebeam, box, boxwood, privet, laurel, bay, bay tree, myrtle,
crepe myrtle, redbud, hackberry, basswood, butternut, joshua tree, palm tree, ironwood, banana tree,
jackfruit tree, silk cotton, flame of the forest, ashoka, deodar, arjun, pine tree, oak tree
`);

const JOBS = words(`
accountant, actor, actress, actuary, acrobat, administrator, admiral, air hostess,
air traffic controller, airman, ambassador, ambulance driver, analyst, anaesthetist,
anesthesiologist, animal keeper, announcer, antique dealer, anthropologist, archaeologist,
architect, archivist, army officer, art dealer, artist, astrologer, astronaut, astronomer, athlete,
attorney, au pair, auctioneer, audiologist, auditor, author, auto driver, babysitter, bailiff,
baker, bank clerk, bank teller, banker, bar staff, barber, barista, barmaid, barrister, bartender,
beautician, beekeeper, bellboy, bin man, binman, biologist, blacksmith, blogger, boatman, bodyguard,
bookkeeper, bookseller, botanist, bouncer, boxer, bricklayer, brewer, broadcaster, broker, builder,
bus conductor, bus driver, busker, businessman, businesswoman, butcher, butler, buyer, cab driver,
cabin crew, call centre worker, cameraman, candlestick maker, captain, care worker, caregiver,
caretaker, carer, carpenter, carpet fitter, cashier, caterer, ceo, chambermaid, chauffeur, chef,
cheesemaker, chemist, childminder, chimney sweep, chiropractor, civil servant, cleaner, clergyman,
clerk, clown, coach, coal miner, coalman, coastguard, cobbler, columnist, comedian, commentator,
composer, concierge, conductor, confectioner, congressman, conservator, construction worker,
consultant, cook, cooper, coroner, councillor, counsellor, counselor, courier, cowboy, crofter,
crossing guard, curator, dairy farmer, dancer, data entry clerk, deckhand, decorator,
delivery driver, delivery man, dental nurse, dental technician, dentist, dermatologist, designer,
detective, developer, dhobi, diplomat, director, disc jockey, distiller, diver, dj, docker, doctor,
dog groomer, dog walker, doorman, drainman, dressmaker, driver, driving instructor, drummer, dustman,
economist, editor, electrician, engineer, entrepreneur, estate agent, executive, factory worker,
farm worker, farmer, farmhand, farrier, ferryman, film director, firefighter, fireman, fisherman,
fishmonger, fitness instructor, flight attendant, florist, footballer, forensic scientist, forester,
forklift driver, fruit picker, funeral director, game warden, gamekeeper, garbage man, gardener,
gas fitter, general, geologist, glazier, goldsmith, golfer, gp, greengrocer, grocer, groom, groomer,
groundskeeper, guard, guitarist, gynaecologist, hairdresser, hairstylist, handyman, harbour master,
hawker, headmaster, headmistress, headteacher, health visitor, heating engineer, historian,
home help, homemaker, horse trainer, hospital porter, hotelier, housekeeper, househusband,
housewife, hygienist, illustrator, imam, innkeeper, instructor, interpreter, inventor, investor,
it worker, jailer, janitor, jeweler, jeweller, jockey, joiner, journalist, judge, juggler,
kennel worker, king, kitchen fitter, lab technician, labourer, laborer, landlord, lawyer, lecturer,
librarian, lifeboatman, lifeguard, lighthouse keeper, locksmith, lollipop lady, lollipop man,
lorry driver, lumberjack, machinist, magician, maid, mail carrier, mailman, make up artist,
manager, manicurist, marine, marine biologist, mason, massage therapist, masseuse, mathematician,
mayor, mechanic, merchant, merchandiser, meter reader, midwife, milkman, milkmaid, mill worker,
miner, minister, missionary, model, monk, musician, nanny, navigator, neurologist, newsagent,
newsreader, nun, nurse, nursery nurse, nutritionist, obstetrician, occupational therapist,
odd job man, officer, oil rig worker, oncologist, optician, optometrist, orderly, orthodontist,
osteopath, paediatrician, painter, pandit, paperboy, paramedic, park ranger, parking attendant,
pastor, pastry chef, pathologist, peddler, personal trainer, pet sitter, pharmacist, photographer,
physician, physicist, physio, physiotherapist, pianist, pilot, plasterer, plumber, poet,
police officer, policeman, policewoman, politician, porter, postal worker, postman, postwoman,
potter, preacher, president, priest, prime minister, principal, printer, prison officer,
private investigator, producer, professor, programmer, psychiatrist, psychologist, publican,
publisher, quarryman, queen, rabbi, radiographer, radiologist, rag and bone man, rancher, ranger,
realtor, receptionist, recycling worker, referee, refuse collector, reporter, researcher, restorer,
rickshaw driver, riveter, road sweeper, roofer, saddler, sailor, sales assistant, salesman,
salesperson, saleswoman, sanitation worker, scaffolder, scientist, scout, sculptor, seamstress,
secretary, security guard, senator, sergeant, shearer, sheep shearer, shepherd, shipbuilder,
shipwright, shop assistant, shop worker, shopkeeper, signalman, silversmith, singer, skipper,
social worker, software developer, software engineer, soldier, solicitor, sommelier, sound engineer,
speech therapist, spy, stable hand, statistician, station master, steelworker, stenographer,
stevedore, steward, stewardess, stockbroker, stonemason, store manager, street cleaner,
street vendor, stuntman, stylist, support worker, surgeon, surveyor, swimming instructor, tailor,
tanner, tattoo artist, taxi driver, teacher, teaching assistant, technician, telemarketer,
telephonist, teller, tennis player, thatcher, therapist, ticket inspector, tiler, tour guide,
traffic warden, train driver, translator, travel agent, trader, trawlerman, truck driver, trucker,
tutor, typist, umpire, undertaker, upholsterer, usher, vendor, vet, vet nurse, veterinarian,
vicar, vintner, violinist, volunteer, waiter, waitress, warden, warehouse worker, washerman,
watchmaker, watchman, weaver, welder, wheelwright, window cleaner, window dresser, winemaker,
wrestler, writer, youth worker, yoga teacher, zookeeper, zoologist, cricketer, cardiologist,
nurse practitioner, doctor's receptionist, dinner lady, dietitian, dietician, groundsman, cook,
school teacher, primary school teacher, sheriff, deputy, marshal, firewoman, fisherwoman, chairman, surgeon, dentist, hospital cleaner
`);

const TOWNS = words(`
New York, New York City, Los Angeles, Chicago, Houston, Phoenix, Philadelphia, San Antonio, San Diego,
Dallas, San Jose, Austin, Jacksonville, Fort Worth, Columbus, Charlotte, San Francisco, Indianapolis,
Seattle, Denver, Washington, Boston, El Paso, Nashville, Detroit, Oklahoma City, Portland, Las Vegas,
Memphis, Louisville, Baltimore, Milwaukee, Albuquerque, Tucson, Fresno, Mesa, Sacramento, Atlanta,
Kansas City, Colorado Springs, Omaha, Raleigh, Miami, Long Beach, Virginia Beach, Oakland,
Minneapolis, Tulsa, Tampa, Arlington, New Orleans, Wichita, Cleveland, Bakersfield, Aurora, Anaheim,
Honolulu, Santa Ana, Riverside, Corpus Christi, Lexington, Henderson, Stockton, Saint Paul,
Cincinnati, Saint Louis, Pittsburgh, Greensboro, Lincoln, Anchorage, Plano, Orlando, Irvine, Newark,
Durham, Chula Vista, Toledo, Fort Wayne, Saint Petersburg, Laredo, Jersey City, Chandler, Madison,
Lubbock, Scottsdale, Reno, Buffalo, Gilbert, Glendale, North Las Vegas, Winston Salem, Chesapeake,
Norfolk, Fremont, Garland, Irving, Hialeah, Richmond, Boise, Spokane, Baton Rouge, Tacoma,
San Bernardino, Modesto, Fontana, Des Moines, Moreno Valley, Santa Clarita, Fayetteville,
Birmingham, Oxnard, Rochester, Port Saint Lucie, Grand Rapids, Huntsville, Salt Lake City, Frisco,
Yonkers, Amarillo, Huntington Beach, McKinney, Montgomery, Augusta, Akron, Little Rock, Tempe,
Overland Park, Grand Prairie, Tallahassee, Cape Coral, Mobile, Knoxville, Shreveport, Worcester,
Ontario, Vancouver, Sioux Falls, Chattanooga, Brownsville, Fort Lauderdale, Providence,
Newport News, Rancho Cucamonga, Santa Rosa, Peoria, Oceanside, Elk Grove, Salem, Pembroke Pines,
Eugene, Garden Grove, Cary, Fort Collins, Corona, Springfield, Jackson, Alexandria, Hayward,
Clarksville, Lakewood, Lancaster, Salinas, Palmdale, Hollywood, Macon, Sunnyvale, Pomona, Killeen,
Escondido, Pasadena, Naperville, Bellevue, Joliet, Murfreesboro, Midland, Rockford, Paterson,
Savannah, Bridgeport, Torrance, McAllen, Syracuse, Surprise, Denton, Roseville, Thornton, Miramar,
Mesquite, Olathe, Dayton, Carrollton, Waco, Orange, Fullerton, Charleston, West Valley City, Visalia,
Hampton, Gainesville, Warren, Coral Springs, Cedar Rapids, Round Rock, Sterling Heights, Kent,
Columbia, Santa Clara, New Haven, Stamford, Concord, Elizabeth, Athens, Thousand Oaks, Lafayette,
Simi Valley, Topeka, Norman, Fargo, Wilmington, Abilene, Odessa, Pearland, Victorville, Hartford,
Vallejo, Allentown, Berkeley, Richardson, Arvada, Ann Arbor, Cambridge, Sugar Land, Lansing,
Evansville, College Station, Fairfield, Clearwater, Beaumont, Independence, Provo, West Jordan,
Murrieta, Palm Bay, El Monte, Carlsbad, Temecula, Clovis, Meridian, Westminster, Costa Mesa,
High Point, Manchester, Pueblo, Lakeland, Pompano Beach, West Palm Beach, Antioch, Everett, Downey,
Lowell, Centennial, Elgin, Broken Arrow, Miami Gardens, Billings, Sandy Springs, Gresham,
Lewisville, Hillsboro, Ventura, Greeley, Inglewood, Waterbury, League City, Santa Maria, Tyler,
Davie, Daly City, Boulder, Allen, West Covina, Sparks, Wichita Falls, Green Bay, San Mateo, Norwalk,
Rialto, Las Cruces, Chico, El Cajon, Burbank, South Bend, Renton, Vista, Davenport, Edinburg,
Tuscaloosa, Carmel, Spokane Valley, San Angelo, Vacaville, Bend, Albany, Trenton, Atlantic City,
Scranton, Harrisburg, Erie, Reading, Bethlehem, York, Annapolis, Dover, Montpelier, Burlington,
Bangor, Nashua, Plymouth, Nantucket, Newport, Greenwich, Princeton, Hoboken, Camden, Brooklyn,
Queens, Bronx, Staten Island, Manhattan, Harlem, Ithaca, Utica, Binghamton, Poughkeepsie,
Schenectady, Saratoga Springs, White Plains, New Rochelle, Niagara Falls, Cooperstown, Lake Placid,
Beverly Hills, Santa Monica, Malibu, Palm Springs, Santa Barbara, Monterey, Napa, Sonoma, Palo Alto,
Mountain View, Cupertino, Menlo Park, Redwood City, Santa Cruz, Sausalito, Key West, Naples,
Sarasota, Daytona Beach, Saint Augustine, Pensacola, Boca Raton, Palm Beach, Fort Myers, Ocala,
Destin, Panama City, Myrtle Beach, Hilton Head, Asheville, Chapel Hill, Roanoke, Charlottesville,
Williamsburg, Lynchburg, Gatlinburg, Branson, Hot Springs, Galveston, San Marcos, Santa Fe, Taos,
Flagstaff, Sedona, Yuma, Tombstone, Aspen, Vail, Cheyenne, Jackson Hole, Missoula, Bozeman, Helena,
Butte, Great Falls, Casper, Laramie, Rapid City, Pierre, Bismarck, Duluth, Saint Cloud, Juneau,
Fairbanks, Hilo, Kona, Lahaina, Olympia, Yakima, Walla Walla, Bellingham, Medford, Coeur d'Alene,
Pocatello, Idaho Falls, Ogden, Saint George, Park City, Carson City, Elko, Dodge City, Lawrence,
Ames, Iowa City, Dubuque, Sioux City, Kalamazoo, Flint, Traverse City, Marquette, Canton,
Youngstown, Sandusky, Bloomington, Muncie, Terre Haute, Gary, Champaign, Urbana, Decatur, Evanston,
Oak Park, Galena, Oshkosh, Eau Claire, La Crosse, Kenosha, Racine, Tupelo, Biloxi, Gulfport,
Hattiesburg, Natchez, Vicksburg, Oxford, Selma, Dothan, Valdosta, Lake Charles, Monroe, Frankfort,
Bowling Green, Paducah, Wheeling, Morgantown, Huntington, Cumberland, Frederick, Hagerstown,
Ocean City, Rehoboth Beach, Cape May, Hershey, Gettysburg, State College, Altoona, Johnstown,
Wilkes Barre, Stillwater, Enid, Lawton, Fort Smith, Texarkana, Jonesboro, Joplin, Jefferson City,
Saint Joseph, Grand Island, Kearney, North Platte, Hoboken, Edison, Paramus, Morristown,
Cherry Hill, Levittown, Hempstead, Babylon, Huntington, Stamford, Danbury, Norwich, New London,
Mystic, Pawtucket, Warwick, Cranston, Brockton, Quincy, Lynn, Framingham, Gloucester, Marblehead,
Lexington, Concord, Amherst, Northampton, Pittsfield, Portsmouth, Keene, Rutland, Bar Harbor,
Kennebunkport, Lewiston, Lowell, Fall River, New Bedford, Hyannis, Provincetown, Martha's Vineyard,
London, Manchester, Liverpool, Leeds, Sheffield, Bristol, Newcastle, Nottingham, Leicester,
Coventry, Bradford, Southampton, Portsmouth, Brighton, Hove, Oxford, Cambridge, Bath, Exeter,
Norwich, Ipswich, Colchester, Chelmsford, Southend, Luton, Watford, Saint Albans, Milton Keynes,
Northampton, Peterborough, Derby, Stoke, Stoke on Trent, Wolverhampton, Walsall, Dudley,
West Bromwich, Solihull, Hereford, Gloucester, Cheltenham, Swindon, Salisbury, Winchester,
Bournemouth, Poole, Weymouth, Dorchester, Torquay, Paignton, Truro, Penzance, Saint Ives, Newquay,
Falmouth, Taunton, Yeovil, Wells, Glastonbury, Canterbury, Folkestone, Margate, Ramsgate, Maidstone,
Tunbridge Wells, Guildford, Woking, Crawley, Horsham, Chichester, Worthing, Eastbourne, Hastings,
Lewes, Basingstoke, Aldershot, Farnborough, Slough, Windsor, Maidenhead, High Wycombe, Aylesbury,
Bedford, Stevenage, Hemel Hempstead, Harlow, Basildon, Hull, Kingston upon Hull, Grimsby,
Scunthorpe, Doncaster, Rotherham, Barnsley, Wakefield, Huddersfield, Halifax, Harrogate,
Scarborough, Whitby, Middlesbrough, Darlington, Sunderland, Gateshead, Carlisle, Kendal, Preston,
Blackpool, Blackburn, Burnley, Bolton, Wigan, Warrington, Chester, Crewe, Stockport, Oldham,
Rochdale, Salford, Bury, Southport, Birkenhead, Telford, Shrewsbury, Stafford, Lichfield, Tamworth,
Nuneaton, Rugby, Stratford upon Avon, Stratford, Warwick, Leamington Spa, Banbury, Kettering, Corby,
Wellingborough, Loughborough, Mansfield, Chesterfield, Buxton, Matlock, Skegness, Boston, Kings Lynn,
Great Yarmouth, Lowestoft, Cromer, Bury Saint Edmunds, Newmarket, Ely, Huntingdon, Dunstable,
Wembley, Croydon, Kingston, Greenwich, Hampstead, Romford, Ilford, Harrow, Enfield, Barnet, Bromley,
Sutton, Wimbledon, Westminster, Islington, Hackney, Brixton, Chelsea, Kensington, Notting Hill,
Ealing, Hammersmith, Fulham, Putney, Clapham, Lewisham, Woolwich, Stratford, Walthamstow,
Tottenham, Southall, Hounslow, Uxbridge, Twickenham, Richmond, Epsom, Reigate, Redhill, Dorking,
Sevenoaks, Tonbridge, Ashford, Gravesend, Dartford, Rochester, Chatham, Gillingham, Sittingbourne,
Faversham, Whitstable, Herne Bay, Deal, Sandwich, Rye, Bexhill, Bognor Regis, Littlehampton,
Arundel, Petersfield, Andover, Newbury, Wokingham, Bracknell, Abingdon, Didcot, Witney, Bicester,
Henley, Marlow, Amersham, Chesham, Beaconsfield, Tring, Berkhamsted, Harpenden, Hitchin, Letchworth,
Welwyn Garden City, Hertford, Bishops Stortford, Saffron Walden, Braintree, Witham, Maldon,
Clacton, Harwich, Felixstowe, Woodbridge, Sudbury, Thetford, Diss, Swaffham, Dereham, Fakenham,
Hunstanton, Wisbech, March, Spalding, Stamford, Grantham, Newark, Worksop, Retford, Gainsborough,
Louth, Horncastle, Sleaford, Beverley, Bridlington, Selby, Goole, Pontefract, Castleford, Dewsbury,
Keighley, Skipton, Ilkley, Otley, Ripon, Thirsk, Northallerton, Richmond, Malton, Pickering, Filey,
Redcar, Hartlepool, Stockton on Tees, Bishop Auckland, Consett, Hexham, Morpeth, Alnwick, Berwick,
Whitley Bay, Tynemouth, South Shields, Jarrow, Washington, Penrith, Keswick, Windermere, Ambleside,
Barrow in Furness, Ulverston, Workington, Whitehaven, Morecambe, Lytham Saint Annes, Fleetwood,
Chorley, Leyland, Ormskirk, Saint Helens, Widnes, Runcorn, Macclesfield, Congleton, Nantwich,
Northwich, Knutsford, Wilmslow, Altrincham, Sale, Stretford, Ashton under Lyne, Hyde, Glossop,
Leek, Uttoxeter, Burton upon Trent, Cannock, Rugeley, Stone, Newcastle under Lyme, Kidderminster,
Bromsgrove, Redditch, Evesham, Malvern, Ledbury, Ross on Wye, Leominster, Ludlow, Bridgnorth,
Oswestry, Market Drayton, Whitchurch, Stroud, Cirencester, Tewkesbury, Chippenham, Trowbridge,
Devizes, Marlborough, Frome, Bridgwater, Minehead, Weston super Mare, Clevedon, Burnham on Sea,
Street, Shepton Mallet, Sherborne, Shaftesbury, Blandford, Wimborne, Christchurch, Lymington,
Ringwood, Romsey, Eastleigh, Fareham, Gosport, Havant, Waterlooville, Newport, Ryde, Cowes,
Sandown, Shanklin, Barnstaple, Bideford, Ilfracombe, Tiverton, Exmouth, Sidmouth, Honiton,
Teignmouth, Dawlish, Newton Abbot, Totnes, Dartmouth, Brixham, Kingsbridge, Tavistock, Okehampton,
Bodmin, Launceston, Bude, Padstow, Wadebridge, Saint Austell, Fowey, Looe, Liskeard, Helston,
Camborne, Redruth, Hayle, Saint Just, Mousehole,
Edinburgh, Glasgow, Aberdeen, Dundee, Inverness, Perth, Stirling, Saint Andrews, Paisley,
Kilmarnock, Ayr, Dumfries, Falkirk, Livingston, Fort William, Oban, Kirkcaldy, Dunfermline,
Motherwell, Hamilton, Greenock, Elgin, Wick, Thurso, Lerwick, Kirkwall, Stornoway, Portree,
Cardiff, Swansea, Wrexham, Bangor, Aberystwyth, Llandudno, Carmarthen, Tenby, Pembroke,
Merthyr Tydfil, Bridgend, Barry, Caerphilly, Pontypridd, Rhyl, Conwy, Caernarfon, Brecon,
Abergavenny, Llanelli, Neath, Belfast, Derry, Londonderry, Armagh, Newry, Lisburn, Coleraine,
Enniskillen, Omagh, Ballymena, Dublin, Cork, Galway, Limerick, Waterford, Kilkenny, Killarney,
Sligo, Drogheda, Dundalk, Wexford, Athlone, Tralee, Ennis, Bray,
Toronto, Montreal, Calgary, Edmonton, Ottawa, Winnipeg, Quebec City, Quebec, Kitchener, Victoria,
Halifax, Oshawa, Windsor, Saskatoon, Regina, Saint John's, Kelowna, Barrie, Sherbrooke, Guelph,
Moncton, Fredericton, Charlottetown, Thunder Bay, Sudbury, Whitehorse, Yellowknife, Iqaluit,
Mississauga, Brampton, Markham, Burnaby, Surrey, Banff, Jasper, Whistler,
Sydney, Melbourne, Brisbane, Adelaide, Canberra, Hobart, Darwin, Gold Coast, Wollongong, Geelong,
Cairns, Townsville, Alice Springs, Ballarat, Bendigo, Toowoomba, Launceston, Auckland, Wellington,
Christchurch, Dunedin, Queenstown, Rotorua, Napier, Nelson, Tauranga,
Mumbai, Bombay, Delhi, New Delhi, Bangalore, Bengaluru, Hyderabad, Chennai, Madras, Kolkata,
Calcutta, Pune, Ahmedabad, Surat, Jaipur, Lucknow, Kanpur, Nagpur, Indore, Bhopal, Visakhapatnam,
Vizag, Patna, Vadodara, Baroda, Ludhiana, Agra, Nashik, Varanasi, Benares, Srinagar, Amritsar,
Allahabad, Prayagraj, Ranchi, Coimbatore, Madurai, Mysore, Mysuru, Kochi, Cochin,
Thiruvananthapuram, Trivandrum, Guwahati, Chandigarh, Goa, Panaji, Shimla, Darjeeling, Udaipur,
Jodhpur, Rishikesh, Haridwar, Vijayawada, Warangal, Guntur, Tirupati, Nellore, Kurnool,
Rajahmundry, Kakinada, Secunderabad, Mangalore, Hubli, Belgaum, Pondicherry, Puducherry, Ooty,
Dehradun, Gwalior, Jabalpur, Raipur, Bhubaneswar, Cuttack, Aurangabad, Rajkot, Meerut, Noida,
Gurgaon, Gurugram, Faridabad, Thane, Navi Mumbai, Kozhikode, Calicut, Thrissur, Salem,
Tiruchirappalli, Trichy, Vellore, Jammu, Leh, Ajmer, Bikaner, Kota, Jhansi, Aligarh, Bareilly,
Gorakhpur, Dhanbad, Jamshedpur, Siliguri, Shillong, Imphal, Aizawl, Gangtok, Agartala, Kohima,
Itanagar, Karimnagar, Khammam, Nizamabad, Eluru, Ongole, Anantapur, Kadapa, Machilipatnam,
Srikakulam, Vizianagaram, Tenali, Nandyal, Hosur, Tirunelveli, Thanjavur, Kanyakumari, Erode,
Tiruppur, Kollam, Alappuzha, Kannur, Manipal, Udupi, Davangere, Bellary, Gulbarga, Bidar, Hampi,
Solapur, Kolhapur, Sangli, Satara, Latur, Nanded, Amravati, Akola, Jalgaon, Ujjain, Mathura,
Vrindavan, Ayodhya, Pushkar, Mount Abu, Manali, Dharamshala, Mussoorie, Nainital, Lonavala,
Karachi, Lahore, Islamabad, Rawalpindi, Peshawar, Faisalabad, Multan, Quetta, Dhaka, Chittagong,
Colombo, Kandy, Kathmandu, Pokhara, Thimphu, Male,
Paris, Marseille, Lyon, Toulouse, Nice, Nantes, Strasbourg, Montpellier, Bordeaux, Lille, Rennes,
Reims, Le Havre, Cannes, Avignon, Calais, Dieppe, Cherbourg, Brest, Grenoble, Dijon, Versailles,
Monaco, Monte Carlo, Berlin, Hamburg, Munich, Cologne, Frankfurt, Stuttgart, Dusseldorf, Dortmund,
Essen, Leipzig, Bremen, Dresden, Hanover, Nuremberg, Bonn, Heidelberg, Aachen, Freiburg, Mainz,
Potsdam, Rome, Milan, Naples, Turin, Palermo, Genoa, Bologna, Florence, Venice, Verona, Pisa, Siena,
Bari, Catania, Messina, Trieste, Sorrento, Amalfi, Capri, Assisi, Padua, Parma, Modena, Madrid,
Barcelona, Valencia, Seville, Zaragoza, Malaga, Bilbao, Granada, Cordoba, Toledo, Salamanca,
San Sebastian, Palma, Ibiza, Benidorm, Alicante, Marbella, Santiago de Compostela, Lisbon, Porto,
Faro, Coimbra, Funchal, Amsterdam, Rotterdam, The Hague, Utrecht, Eindhoven, Groningen, Maastricht,
Delft, Leiden, Haarlem, Brussels, Antwerp, Ghent, Bruges, Liege, Luxembourg, Zurich, Geneva, Basel,
Bern, Lausanne, Lucerne, Zermatt, Vienna, Salzburg, Innsbruck, Graz, Linz, Prague, Brno, Bratislava,
Budapest, Warsaw, Krakow, Gdansk, Wroclaw, Poznan, Lodz, Copenhagen, Aarhus, Odense, Stockholm,
Gothenburg, Malmo, Uppsala, Oslo, Bergen, Trondheim, Stavanger, Tromso, Helsinki, Tampere, Turku,
Reykjavik, Tallinn, Riga, Vilnius, Moscow, Kiev, Kyiv, Lviv, Odessa, Kharkiv, Minsk, Bucharest,
Sofia, Belgrade, Zagreb, Split, Dubrovnik, Ljubljana, Sarajevo, Skopje, Tirana, Podgorica,
Thessaloniki, Istanbul, Ankara, Izmir, Antalya, Nicosia, Valletta, Gibraltar, Andorra, San Marino,
Vaduz, Tokyo, Osaka, Kyoto, Yokohama, Nagoya, Sapporo, Kobe, Hiroshima, Nagasaki, Fukuoka, Nara,
Beijing, Peking, Shanghai, Hong Kong, Guangzhou, Canton, Shenzhen, Chengdu, Chongqing, Wuhan, Xian,
Nanjing, Tianjin, Hangzhou, Macau, Taipei, Seoul, Busan, Pyongyang, Bangkok, Chiang Mai, Phuket,
Hanoi, Ho Chi Minh City, Saigon, Phnom Penh, Vientiane, Yangon, Rangoon, Mandalay, Kuala Lumpur,
Penang, Singapore, Jakarta, Denpasar, Surabaya, Manila, Cebu, Dubai, Abu Dhabi, Sharjah, Doha,
Riyadh, Jeddah, Mecca, Medina, Muscat, Kuwait City, Manama, Tehran, Baghdad, Basra, Damascus,
Aleppo, Beirut, Amman, Jerusalem, Tel Aviv, Haifa, Nazareth, Cairo, Luxor, Aswan, Casablanca,
Marrakesh, Marrakech, Fez, Tangier, Rabat, Tunis, Algiers, Tripoli, Khartoum, Addis Ababa, Nairobi,
Mombasa, Kampala, Dar es Salaam, Zanzibar, Kigali, Lagos, Abuja, Accra, Dakar, Kinshasa, Luanda,
Harare, Lusaka, Johannesburg, Cape Town, Durban, Pretoria, Port Elizabeth, Windhoek, Gaborone,
Maputo, Antananarivo, Mexico City, Guadalajara, Monterrey, Cancun, Acapulco, Tijuana, Puebla,
Oaxaca, Havana, Nassau, San Juan, Santo Domingo, Port au Prince, Bridgetown, Managua,
Guatemala City, Tegucigalpa, San Salvador, Bogota, Medellin, Cartagena, Cali, Caracas, Quito,
Guayaquil, Lima, Cusco, La Paz, Santiago, Valparaiso, Buenos Aires, Mendoza, Montevideo, Asuncion,
Rio de Janeiro, Rio, Sao Paulo, Brasilia, Salvador, Recife, Fortaleza, Manaus, Belo Horizonte,
Porto Alegre, Curitiba, Hollywood, Atlantic City, Kingston
`);

const INSTRUMENTS = words(`
piano, grand piano, upright piano, keyboard, organ, pipe organ, electric organ, harmonium,
synthesizer, synth, accordion, concertina, melodeon, harmonica, mouth organ, harpsichord,
clavichord, celesta, guitar, acoustic guitar, electric guitar, bass guitar, bass, double bass,
ukulele, uke, banjo, mandolin, lute, sitar, veena, sarod, harp, lyre, zither, dulcimer,
hammered dulcimer, autoharp, violin, fiddle, viola, cello, violoncello, contrabass, erhu,
balalaika, bouzouki, oud, shamisen, koto, pipa, guzheng, flute, piccolo, recorder, tin whistle,
penny whistle, whistle, fife, pan pipes, panpipes, pan flute, clarinet, bass clarinet, oboe,
cor anglais, english horn, bassoon, contrabassoon, saxophone, sax, alto sax, tenor sax, bagpipes,
bagpipe, trumpet, cornet, flugelhorn, bugle, trombone, tuba, sousaphone, french horn, horn,
euphonium, baritone, didgeridoo, conch, shofar, drum, drums, drum kit, snare drum, bass drum,
kettle drum, timpani, bongo, bongos, conga, congas, djembe, tabla, dhol, dholak, mridangam,
tambourine, tambour, cymbal, cymbals, hi hat, gong, triangle, xylophone, glockenspiel, marimba,
vibraphone, vibes, steel drum, steel pan, bell, bells, handbells, hand bell, sleigh bells, cowbell,
chimes, tubular bells, wind chimes, castanets, maracas, claves, woodblock, wood block, guiro,
cabasa, washboard, spoons, bones, kazoo, jaw harp, jews harp, ocarina, melodica, theremin, rattle,
shaker, rain stick, cajon, kalimba, thumb piano, mbira, steel guitar, pedal steel, slide guitar,
twelve string guitar, spinet, virginal, calliope, hurdy gurdy, bodhran, uilleann pipes, shehnai,
nadaswaram, bansuri, santoor, tanpura, sarangi, ektara, ghatam, kanjira, pungi, drum machine,
keytar, electric piano, spinet piano, church organ, hammond organ, bass fiddle, washtub bass,
banjolele, charango, cavaquinho, pipe, reed pipe, harmonium, sruti box
`);

const SEASIDE = words(`
sea, ocean, beach, sand, sandcastle, sand castle, sand dune, dune, shell, seashell, sea shell,
pebble, stone, rock, rock pool, rockpool, cliff, cave, bay, cove, harbour, harbor, pier, jetty,
promenade, prom, boardwalk, esplanade, seafront, sea wall, breakwater, groyne, lighthouse,
lifeguard, lifeguard tower, lifeboat, coastguard, beach hut, beach house, deckchair, deck chair,
sun lounger, windbreak, parasol, beach umbrella, umbrella, towel, beach towel, blanket, picnic,
picnic basket, picnic blanket, cool box, cooler, flask, sandwich, bucket, spade, bucket and spade,
net, fishing net, shrimping net, crabbing line, crabbing net, fishing rod, rod, kite, frisbee,
beach ball, ball, lilo, inflatable, rubber ring, float, bodyboard, surfboard, surfer, paddleboard,
kayak, canoe, boat, sailboat, sailing boat, yacht, dinghy, rowing boat, pedalo, speedboat, jet ski,
fishing boat, trawler, ferry, ship, cruise ship, liner, tanker, buoy, anchor, rope, lobster pot,
crab pot, seaweed, kelp, driftwood, wave, tide, surf, foam, spray, horizon, sunset, sunrise, sun,
sunshine, sun cream, suncream, sunscreen, sun lotion, sunglasses, sun hat, hat, swimsuit,
swimming costume, trunks, bikini, flip flops, sandals, wetsuit, goggles, snorkel, flippers,
ice cream, ice cream van, ice lolly, lolly, cone, ninety nine, candy floss, candyfloss,
cotton candy, stick of rock, fish and chips, chips, chip shop, doughnut, donut, whelks,
crab sticks, toffee apple, hot dog, burger van, arcade, amusement arcade, amusements,
slot machine, penny arcade, fairground, funfair, big wheel, ferris wheel, roller coaster,
carousel, merry go round, helter skelter, dodgems, bumper cars, donkey, donkey ride,
punch and judy, crazy golf, mini golf, pitch and putt, bandstand, band, postcard, souvenir,
gift shop, cafe, beach cafe, kiosk, hotel, guest house, bed and breakfast, caravan, caravan park,
campsite, tent, car park, bench, bin, telescope, binoculars, tourist, holidaymaker, sunbather,
swimmer, fisherman, dog, coast, shore, shoreline, seashore, sandbank, estuary, island, lagoon,
reef, salt water, breeze, sea breeze, wind, mist, fog, sky, cloud, life jacket, lifejacket,
life ring, flag, red flag, slipway, marina, dock, quay, wharf, mudflat, marsh, seagull, gull,
herring gull, cormorant, puffin, tern, oystercatcher, sandpiper, gannet, pelican, albatross,
heron, kittiwake, sand hopper, beach hut, windsurfer, sailor, sail, deck, rock candy, pinwheel,
windmill, sandals, spade, sunbed, beach bag, shells, crabs, starfish, sand eel, fish
`);

const GARDEN = words(`
grass, lawn, flower, flower bed, border, hedge, bush, shrub, plant, weed, soil, earth, dirt, mud,
compost, compost heap, manure, mulch, bark, gravel, pebble, stone, rock, rockery, path, patio,
decking, deck, fence, gate, wall, trellis, arch, pergola, gazebo, summerhouse, greenhouse, shed,
potting shed, cold frame, vegetable patch, vegetable garden, herb garden, pond, fountain,
water feature, bird bath, birdbath, bird table, bird feeder, bird box, nest box, birdhouse,
bird house, bird seed, nest, sundial, statue, gnome, garden gnome, ornament, bench, garden bench,
seat, chair, deckchair, sun lounger, lounger, table, parasol, umbrella, hammock, swing, slide,
climbing frame, trampoline, sandpit, sandbox, paddling pool, barbecue, bbq, grill, fire pit,
chiminea, lantern, light, solar light, fairy lights, washing line, clothesline, clothes peg, peg,
rotary dryer, dustbin, bin, water butt, rain barrel, watering can, hose, hosepipe, sprinkler, tap,
spade, shovel, fork, garden fork, trowel, rake, hoe, dibber, shears, secateurs, pruners, loppers,
clippers, hedge trimmer, strimmer, lawnmower, mower, lawn mower, wheelbarrow, barrow, bucket, pot,
flower pot, plant pot, planter, window box, hanging basket, trough, seed tray, seed, bulb,
seedling, cutting, cane, stake, twine, string, netting, gardening gloves, gloves, kneeler,
kneeling pad, wellies, boots, sun hat, scarecrow, cloche, fruit cage, compost bin, leaf, twig,
branch, stick, log, woodpile, stump, root, moss, vine, climber, herb, rosemary, thyme, sage,
chives, oregano, bay, worm, earthworm, slug, snail, ant, bee, bumblebee, wasp, butterfly, moth,
caterpillar, ladybird, ladybug, spider, beetle, aphid, greenfly, woodlouse, centipede, millipede,
grasshopper, cricket, dragonfly, frog, toad, newt, hedgehog, squirrel, mole, mouse, vole, rabbit,
fox, badger, deer, cat, dog, bird, robin, blackbird, sparrow, starling, thrush, blue tit, great tit,
wren, finch, goldfinch, chaffinch, greenfinch, pigeon, wood pigeon, dove, magpie, crow, jay,
woodpecker, nuthatch, dunnock, cardinal, blue jay, chickadee, hummingbird, owl, bat, chipmunk,
raccoon, possum, lizard, snake, grass snake, gopher, rat, fly, mosquito, gnat, cobweb, web,
spider web, sun, sunshine, rain, shade, puddle, fish, goldfish, koi, kennel, dog kennel, hutch,
rabbit hutch, chicken coop, hen house, chicken, hen, beehive, hive, garage, driveway, porch,
veranda, verandah, conservatory, garden furniture, playhouse, wendy house, tree house, treehouse,
football, bicycle, bike, toys, pool, swimming pool, hot tub, jacuzzi, patio heater, weather vane,
wind chime, wind chimes, doormat, letterbox, mailbox, drain, drainpipe, gutter, edging, plant label,
label, pesticide, fertiliser, fertilizer, weedkiller, slug pellets, grass seed, turf, meadow,
orchard, nettle, stinging nettle, bramble, tulsi, tulsi plant, well, bird bath, lawn chair,
garden hose, garden shed, garden path, allotment, raised bed, vegetable bed, flower border,
tree, fruit tree, vegetable, herbs, fruit, fruit bush, sapling, hedgerow, lawn chair
`);

// Answers that name the category itself rather than something in it.
const GROUP_WORDS = {
  animals: ["animal", "animals", "creature", "mammal", "pet", "wildlife"],
  birds: ["bird", "birds"],
  "fruits and vegetables": ["fruit", "fruits", "vegetable", "vegetables", "veg", "veggie", "veggies", "produce"],
  "things in a kitchen": ["kitchen", "kitchen stuff", "stuff"],
  "things you wear": ["clothing", "clothes", "outfit", "garment", "things"],
  "towns and cities": ["town", "towns", "city", "cities", "village", "place"],
  "flowers and trees": ["flower", "flowers", "tree", "trees", "plant", "plants", "bush", "shrub"],
  "jobs people do": ["job", "jobs", "work", "worker", "career", "profession", "occupation"],
  "things in a garden": ["garden", "yard", "backyard", "things"],
  "things that go in a sandwich": ["sandwich", "sandwiches", "filling", "fillings"],
  "musical instruments": ["instrument", "instruments", "music", "musical instrument"],
  "things at the seaside": ["seaside", "beach stuff", "things"],
};

// A word like "tree" after a real answer ("apple tree") is fine: it is only
// dropped, never counted separately and never reported as wrong.
const TRAILING_OK = {
  "flowers and trees": ["tree", "trees", "flower", "flowers", "bush", "bushes", "plant", "plants", "blossom"],
  "things in a garden": ["tree", "trees", "flower", "flowers", "bush", "bushes", "plant", "plants"],
  "fruits and vegetables": ["fruit", "fruits", "berry", "berries"],
  "towns and cities": ["city", "town"],
  "musical instruments": ["instrument"],
};

const union = (...lists) => lists.flat();

export const FLUENCY_LISTS = {
  animals: union(ANIMALS, BIRDS, SEA_CREATURES),
  birds: BIRDS,
  "fruits and vegetables": FRUITS_VEG,
  "things in a kitchen": union(KITCHEN, FRUITS_VEG, SANDWICH),
  "things you wear": WEAR,
  "towns and cities": TOWNS,
  "flowers and trees": FLOWERS_TREES,
  "jobs people do": JOBS,
  "things in a garden": union(GARDEN, FLOWERS_TREES, FRUITS_VEG),
  "things that go in a sandwich": union(SANDWICH, FRUITS_VEG),
  "musical instruments": INSTRUMENTS,
  "things at the seaside": union(SEASIDE, SEA_CREATURES),
};

// How one item of each category is described in a message: "not ... as a bird".
export const FLUENCY_ONE = {
  animals: "an animal",
  birds: "a bird",
  "fruits and vegetables": "a fruit or vegetable",
  "things in a kitchen": "something in a kitchen",
  "things you wear": "something you wear",
  "towns and cities": "a town or city",
  "flowers and trees": "a flower or tree",
  "jobs people do": "a job",
  "things in a garden": "something in a garden",
  "things that go in a sandwich": "something for a sandwich",
  "musical instruments": "a musical instrument",
  "things at the seaside": "something at the seaside",
};

// One example of each, for when someone names the whole group ("bird").
export const FLUENCY_EXAMPLE = {
  animals: "a dog",
  birds: "a robin",
  "fruits and vegetables": "an apple",
  "things in a kitchen": "a kettle",
  "things you wear": "a hat",
  "towns and cities": "London",
  "flowers and trees": "a rose",
  "jobs people do": "a baker",
  "things in a garden": "a spade",
  "things that go in a sandwich": "cheese",
  "musical instruments": "a piano",
  "things at the seaside": "a shell",
};

// Words that are never an answer on their own: "um", "a", "and then", "I think".
const FILLER = new Set(`
a an the some any um umm uh uhh er erm hmm hm mm oh ah and or then also plus like maybe perhaps
another one more i think say well ok okay yes yeah no of course lots my our is it its that there
theres was what about how too again let me see so
`.split(/\s+/).filter(Boolean));

// Describing words. Said before an answer ("big brown bear") they are fine.
const DESCRIBING = new Set(`
big small little large tiny giant huge baby young old wild tame pet cute fat thin tall long short
fresh ripe red green yellow blue brown black white grey gray pink purple golden silver spotted
striped fluffy sweet sour hot cold frozen dried raw cooked roasted fried grilled sliced chopped
crispy soft hard warm woolly wooly woollen wool cotton silk leather denim winter summer pretty
beautiful lovely nice favourite favorite common great lesser male female mother father
`.split(/\s+/).filter(Boolean));

const ABBREVIATIONS = { st: "saint", mt: "mount", ft: "fort" };
const BREAK = "|";

/** Lower case, no accents or punctuation, split into words. Commas become breaks. */
function tokens(text) {
  return String(text || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[,;\n]+/g, ` ${BREAK} `)
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9|\s]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => ABBREVIATIONS[t] || t);
}

const IRREGULAR = {
  geese: "goose", mice: "mouse", lice: "louse", teeth: "tooth", feet: "foot", oxen: "ox",
  children: "child", people: "person", women: "woman", men: "man", knives: "knife", loaves: "loaf",
  leaves: "leaf", wolves: "wolf", calves: "calf", halves: "half", shelves: "shelf", scarves: "scarf",
  hooves: "hoof", cacti: "cactus", octopi: "octopus", fungi: "fungus", potatoes: "potato",
  tomatoes: "tomato", mangoes: "mango",
};

/** The word itself plus the singular forms it could be ("berries" -> "berry"). */
function singularForms(w) {
  const out = [w];
  if (IRREGULAR[w]) out.push(IRREGULAR[w]);
  if (w.length > 4 && w.endsWith("men")) out.push(w.slice(0, -3) + "man");
  if (w.length > 4 && w.endsWith("ies")) out.push(w.slice(0, -3) + "y");
  if (w.length > 4 && w.endsWith("ves")) out.push(w.slice(0, -3) + "f", w.slice(0, -3) + "fe");
  if (w.length > 3 && w.endsWith("es")) out.push(w.slice(0, -2));
  if (w.length > 2 && w.endsWith("s") && !w.endsWith("ss")) out.push(w.slice(0, -1));
  return out;
}

/** Keys for a run of words: spaces removed, last word in every singular form. */
function keysFor(toks) {
  const head = toks.slice(0, -1).join("");
  return singularForms(toks[toks.length - 1]).map((last) => head + last);
}

// Built once per category, on first use: key -> the label to show.
const indexes = new Map();
let everyKey = null;

function indexFor(category) {
  if (indexes.has(category)) return indexes.get(category);
  const list = FLUENCY_LISTS[category];
  if (!list) return null;
  const map = new Map();
  let longest = 1;
  for (const label of list) {
    const toks = tokens(label);
    if (!toks.length) continue;
    longest = Math.max(longest, toks.length);
    const shown = category === "towns and cities" ? label : label.toLowerCase();
    // The exact form wins; singular forms of list words only fill gaps
    // ("flip flops" also answers to "flip flop").
    map.set(toks.join(""), shown);
    for (const k of keysFor(toks)) if (!map.has(k)) map.set(k, shown);
  }
  const index = { map, longest };
  indexes.set(category, index);
  return index;
}

/** True when a word is in any of the lists, in any category. */
function knownAnywhere(word) {
  if (!everyKey) {
    everyKey = new Set();
    for (const c of Object.keys(FLUENCY_LISTS)) for (const k of indexFor(c).map.keys()) everyKey.add(k);
  }
  return keysFor([word]).some((k) => everyKey.has(k));
}

/** Edit distance, counting a swap of two neighbouring letters as one. */
function distance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
      rowMin = Math.min(rowMin, d[i][j]);
    }
    if (rowMin > max) return max + 1;
  }
  return d[a.length][b.length];
}

/**
 * The list entry a misspelling was most likely meant to be, to offer as
 * "Did you mean ...?". Nothing is counted until the person taps it. No offer
 * when the word is itself an answer somewhere else ("carrot" is not offered
 * as parrot), or when two entries are equally close.
 */
function nearestEntry(index, word) {
  if (word.length < 4 || knownAnywhere(word)) return null;
  const max = word.length >= 7 ? 2 : 1;
  let best = null;
  let bestDistance = max + 1;
  let tie = false;
  for (const [k, label] of index.map) {
    if (k[0] !== word[0]) continue;
    const d = distance(word, k, max);
    if (d > max) continue;
    const key = tokens(label).join("");
    if (d < bestDistance) { best = { key, label }; bestDistance = d; tie = false; }
    else if (d === bestDistance && best.key !== key) tie = true;
  }
  return tie ? null : best;
}

function lookup(index, toks) {
  for (const k of keysFor(toks)) {
    const label = index.map.get(k);
    if (label) return { key: tokens(label).join(""), label };
  }
  return null;
}

/**
 * Checks one answer (typed or spoken) for a category.
 *
 * Returns what to count and what to say:
 *   added     [{key, label}] new items to count
 *   repeats   [label]        items already named this round
 *   rejected  [text]         words that are not in the category
 *   groupOnly true when the answer was only the category name ("bird")
 *   suggestion {key, label, already}  what a misspelling probably meant, or
 *                            null. Not counted unless the person says yes;
 *                            `already` marks one they have named already.
 */
export function checkFluencyAnswer(category, text, alreadyNamed = new Set()) {
  const out = { added: [], repeats: [], rejected: [], groupOnly: false, suggestion: null };
  const index = indexFor(category);
  if (!index) return out;
  const group = new Set((GROUP_WORDS[category] || []).flatMap((g) => tokens(g)));
  const trailing = new Set(TRAILING_OK[category] || []);
  const seen = new Set(alreadyNamed);

  const take = (hit) => {
    if (seen.has(hit.key)) {
      if (!out.repeats.includes(hit.label)) out.repeats.push(hit.label);
      return;
    }
    seen.add(hit.key);
    out.added.push(hit);
  };

  // Read left to right, taking the longest known run of words each time, so
  // "fish and chips" is one answer and "robin sparrow and eagle" is three.
  // Commas, "and", "or" and "then" separate answers when they are not part
  // of one.
  const toks = tokens(text);
  let pending = [];      // unknown words since the last answer or break
  let answered = false;  // an answer has been found since the last break

  const flush = () => {
    const left = pending.filter((t) => !FILLER.has(t) && !(answered && (trailing.has(t) || group.has(t))));
    if (left.length) {
      if (!answered && left.every((t) => group.has(t) || trailing.has(t))) out.groupOnly = true;
      else out.rejected.push(left.join(" "));
    }
    pending = [];
    answered = false;
  };

  let i = 0;
  while (i < toks.length) {
    const t = toks[i];
    if (t === BREAK) { flush(); i++; continue; }

    let found = null;
    for (let n = Math.min(index.longest, toks.length - i); n >= 1; n--) {
      const run = toks.slice(i, i + n);
      if (run.includes(BREAK)) continue;
      const hit = lookup(index, run);
      if (hit) { found = { hit, n }; break; }
    }

    if (found) {
      // Words just before an answer describe it ("brown bear", "school
      // teacher"), unless they are an answer to something else, the way
      // "pond" is: "pond duck" is two answers, and pond is not a bird.
      const wrong = pending.filter((w) => !FILLER.has(w) && !DESCRIBING.has(w) && !group.has(w) && knownAnywhere(w));
      if (wrong.length) out.rejected.push(wrong.join(" "));
      pending = [];
      take(found.hit);
      answered = true;
      i += found.n;
    } else if (t === "and" || t === "or" || t === "then") {
      flush();
      i++;
    } else {
      pending.push(t);
      i++;
    }
  }
  flush();

  for (const text of out.rejected) {
    const near = nearestEntry(index, text.replace(/\s+/g, ""));
    if (!near) continue;
    // The nearest answer is one they have already given: say that, rather
    // than leaving them to wonder what was wrong with the word.
    out.suggestion = seen.has(near.key) ? { ...near, already: true } : near;
    break;
  }
  return out;
}
