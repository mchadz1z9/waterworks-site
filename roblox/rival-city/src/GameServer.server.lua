-- Rival City (Roblox edition) — server
-- Everything that has to be trusted lives here: money, cars, jobs, houses, saving.
-- The map itself is built into the place file (Workspace > Map); parts with special names get wired up below:
--   "Lamp"            street-light heads (light up at night)
--   "Sign:<text>"     signs (text drawn on the front face)
--   "Prompt:<name>"   interaction points (Depot, Dealer)
--   Map.Houses.House_N  houses for sale (each has a "Door" and a "SignPost")

local Players = game:GetService("Players")
local RS = game:GetService("ReplicatedStorage")
local Lighting = game:GetService("Lighting")
local DSS = game:GetService("DataStoreService")

local CityData = require(RS:WaitForChild("CityData"))
local Map = workspace:WaitForChild("Map")
local CarsFolder = workspace:FindFirstChild("Cars") or Instance.new("Folder")
CarsFolder.Name = "Cars"; CarsFolder.Parent = workspace
local CoinsFolder = workspace:FindFirstChild("Coins") or Instance.new("Folder")
CoinsFolder.Name = "Coins"; CoinsFolder.Parent = workspace

---------------------------------------------------------------- remotes
local Remotes = Instance.new("Folder"); Remotes.Name = "Remotes"
local function remote(class, name) local r = Instance.new(class); r.Name = name; r.Parent = Remotes; return r end
local Notify = remote("RemoteEvent", "Notify")
local SpawnCar = remote("RemoteEvent", "SpawnCar")
local BuyCar = remote("RemoteFunction", "BuyCar")
local JobEv = remote("RemoteEvent", "Job")
local Teleport = remote("RemoteEvent", "Teleport")
local OpenUI = remote("RemoteEvent", "OpenUI")
Remotes.Parent = RS

local CarById = {}
for _, c in ipairs(CityData.Cars) do CarById[c.Id] = c end

---------------------------------------------------------------- look: bright, sunny, a little hazy
Lighting.Brightness = 2.4
Lighting.ClockTime = 9
Lighting.GeographicLatitude = 25
Lighting.Ambient = Color3.fromRGB(70, 70, 85)
Lighting.OutdoorAmbient = Color3.fromRGB(140, 140, 155)
Lighting.EnvironmentDiffuseScale = 1
Lighting.EnvironmentSpecularScale = 1
local function fx(class, props) local o = Instance.new(class); for k, v in pairs(props) do o[k] = v end; o.Parent = Lighting; return o end
fx("Atmosphere", { Density = 0.28, Offset = 0.12, Color = Color3.fromRGB(205, 225, 245), Decay = Color3.fromRGB(120, 150, 195), Glare = 0.25, Haze = 1.1 })
fx("ColorCorrectionEffect", { Saturation = 0.18, Contrast = 0.06, Brightness = 0.02 })
fx("BloomEffect", { Intensity = 0.35, Size = 24, Threshold = 1.7 })
fx("SunRaysEffect", { Intensity = 0.05, Spread = 0.6 })

---------------------------------------------------------------- terrain: beach, ocean you can swim in, hills around the edges
do
	local T = workspace.Terrain
	local B = CityData.Beach
	T:FillBlock(CFrame.new(B.SandX, -1.8, 0), Vector3.new(B.SandW, 4, B.Length), Enum.Material.Sand)
	T:FillBlock(CFrame.new(B.SeaX, -9, 0), Vector3.new(B.SeaW, 18, B.Length), Enum.Material.Water)
	T:FillBlock(CFrame.new(B.SeaX, -22, 0), Vector3.new(B.SeaW, 8, B.Length), Enum.Material.Sand)
	for _, h in ipairs(CityData.Hills) do
		T:FillBall(h.Pos, h.R, Enum.Material.Grass)
	end
end

---------------------------------------------------------------- signs, street lights, interaction points
local lamps, prompts = {}, {}
local function makeSign(part, txt)
	local g = Instance.new("SurfaceGui")
	g.Face = Enum.NormalId.Front
	g.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
	g.PixelsPerStud = 30
	g.LightInfluence = 0.2
	local t = Instance.new("TextLabel")
	t.Size = UDim2.fromScale(1, 1)
	t.BackgroundTransparency = 1
	t.Text = txt
	t.TextScaled = true
	t.Font = Enum.Font.FredokaOne
	t.TextColor3 = Color3.new(1, 1, 1)
	t.TextStrokeTransparency = 0.4
	t.Parent = g
	g.Parent = part
end
for _, d in ipairs(Map:GetDescendants()) do
	if d:IsA("BasePart") then
		local n = d.Name
		if n == "Lamp" then
			local l = Instance.new("PointLight")
			l.Range = 38; l.Brightness = 1.8; l.Color = Color3.fromRGB(255, 215, 160); l.Shadows = false; l.Enabled = false
			l.Parent = d
			table.insert(lamps, { part = d, light = l })
		elseif string.sub(n, 1, 5) == "Sign:" then
			makeSign(d, string.sub(n, 6))
		elseif string.sub(n, 1, 7) == "Prompt:" then
			prompts[string.sub(n, 8)] = d
		end
	end
end

-- day / night: a full day takes 12 minutes; street lights come on after dark
task.spawn(function()
	local lastNight = nil
	while true do
		local dt = task.wait(0.5)
		Lighting.ClockTime = (Lighting.ClockTime + dt * 24 / 720) % 24
		local night = Lighting.ClockTime < 6.3 or Lighting.ClockTime > 18.1
		if night ~= lastNight then
			lastNight = night
			for _, L in ipairs(lamps) do
				L.light.Enabled = night
				L.part.Material = night and Enum.Material.Neon or Enum.Material.SmoothPlastic
			end
		end
	end
end)

---------------------------------------------------------------- saving
local store = nil
pcall(function() store = DSS:GetDataStore("RivalCity_v1") end)
local data = {}

local function loadData(p)
	local d = nil
	if store then
		local ok, res = pcall(function() return store:GetAsync("u" .. p.UserId) end)
		if ok and type(res) == "table" then d = res end
	end
	d = d or {}
	d.cash = tonumber(d.cash) or 500
	d.jobs = tonumber(d.jobs) or 0
	if type(d.cars) ~= "table" then d.cars = {} end
	d.cars.hatch = true
	return d
end
local function saveData(p)
	local d = data[p]
	if not d or not store then return end
	pcall(function()
		store:SetAsync("u" .. p.UserId, { cash = d.cash, jobs = d.jobs, cars = d.cars, house = d.house })
	end)
end

local function setCash(p, v)
	local d = data[p]
	if not d then return end
	d.cash = math.max(0, math.floor(v))
	local ls = p:FindFirstChild("leaderstats")
	if ls and ls:FindFirstChild("Cash") then ls.Cash.Value = d.cash end
end
local function addCash(p, n, why)
	local d = data[p]
	if not d then return end
	setCash(p, d.cash + n)
	if why then Notify:FireClient(p, (n >= 0 and "+$" or "-$") .. math.abs(n) .. "  " .. why, "cash") end
end
local function syncCars(p)
	local d = data[p]
	if not d then return end
	local list = {}
	for id, owned in pairs(d.cars) do if owned then table.insert(list, id) end end
	p:SetAttribute("Cars", table.concat(list, ","))
end

local function hrpOf(p)
	local c = p.Character
	return c and c:FindFirstChild("HumanoidRootPart"), c and c:FindFirstChildOfClass("Humanoid")
end

---------------------------------------------------------------- cars
-- A car is one invisible collision base with welded body parts. When someone drives, the server hands the car's
-- physics to that player's computer, and their script steers it with a BodyVelocity + BodyGyro (smooth, no lag).
local function newPart(parent, props)
	local p = Instance.new("Part")
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Material = Enum.Material.SmoothPlastic
	for k, v in pairs(props) do p[k] = v end
	p.Parent = parent
	return p
end
local function weld(a, b)
	local w = Instance.new("WeldConstraint"); w.Part0 = a; w.Part1 = b; w.Parent = a
end

local function buildCar(spec, cf, opts)
	opts = opts or {}
	local L, Wd, H = spec.Len, spec.Wid, spec.H
	local display = opts.display
	local model = Instance.new("Model")
	model.Name = spec.Name
	local base = newPart(model, { Name = "Base", Size = Vector3.new(Wd - 0.4, 0.8, L - 1), CFrame = cf * CFrame.new(0, 0.5, 0),
		Transparency = 1, CustomPhysicalProperties = PhysicalProperties.new(1, 0, 0, 100, 1) })
	local dark = Color3.fromRGB(30, 32, 38)
	local function deco(name, size, off, color, mat, shape)
		local p = newPart(model, { Name = name, Size = size, CFrame = cf * off, Color = color, CanCollide = false, Massless = true })
		if mat then p.Material = mat end
		if shape then p.Shape = shape end
		weld(base, p)
		return p
	end
	local top = 1.0 + H
	deco("Body", Vector3.new(Wd, H, L), CFrame.new(0, 1.0 + H / 2, 0), spec.Color)
	if spec.Style == "truck" then
		deco("Cabin", Vector3.new(Wd - 0.4, 2.3, L * 0.34), CFrame.new(0, top + 1.15, -L * 0.18), Color3.fromRGB(40, 55, 75), Enum.Material.Glass).Transparency = 0.35
		deco("Roof", Vector3.new(Wd - 0.3, 0.3, L * 0.36), CFrame.new(0, top + 2.4, -L * 0.18), spec.Color)
		deco("BedL", Vector3.new(0.35, 1.1, L * 0.45), CFrame.new(-Wd / 2 + 0.2, top + 0.55, L * 0.26), spec.Color)
		deco("BedR", Vector3.new(0.35, 1.1, L * 0.45), CFrame.new(Wd / 2 - 0.2, top + 0.55, L * 0.26), spec.Color)
		deco("BedB", Vector3.new(Wd, 1.1, 0.35), CFrame.new(0, top + 0.55, L / 2 - 0.2), spec.Color)
	else
		local ch = spec.Style == "super" and 1.7 or 2.3
		local cz = spec.Style == "super" and L * 0.06 or L * 0.04
		deco("Cabin", Vector3.new(Wd - 0.5, ch, L * 0.46), CFrame.new(0, top + ch / 2, cz), Color3.fromRGB(40, 55, 75), Enum.Material.Glass).Transparency = 0.35
		deco("Roof", Vector3.new(Wd - 0.4, 0.3, L * 0.42), CFrame.new(0, top + ch + 0.1, cz), spec.Color)
		if spec.Style == "taxi" then
			local s = deco("TaxiSign", Vector3.new(2.4, 0.7, 1), CFrame.new(0, top + ch + 0.6, cz), Color3.fromRGB(255, 240, 150), Enum.Material.Neon)
			s.Name = "TaxiSign"
		end
		if spec.Style == "super" then
			deco("Spoiler", Vector3.new(Wd, 0.25, 1.2), CFrame.new(0, top + 0.9, L / 2 - 0.7), dark)
			deco("SpoilerL", Vector3.new(0.25, 0.8, 0.6), CFrame.new(-Wd / 2 + 0.6, top + 0.4, L / 2 - 0.7), dark)
			deco("SpoilerR", Vector3.new(0.25, 0.8, 0.6), CFrame.new(Wd / 2 - 0.6, top + 0.4, L / 2 - 0.7), dark)
		end
	end
	deco("BumperF", Vector3.new(Wd + 0.1, 0.55, 0.5), CFrame.new(0, 1.15, -L / 2), dark)
	deco("BumperR", Vector3.new(Wd + 0.1, 0.55, 0.5), CFrame.new(0, 1.15, L / 2), dark)
	for _, sx in ipairs({ -1, 1 }) do
		deco("HeadLight", Vector3.new(1.2, 0.5, 0.2), CFrame.new(sx * (Wd / 2 - 0.9), 1.0 + H * 0.7, -L / 2 - 0.06), Color3.fromRGB(255, 250, 220), Enum.Material.Neon)
		deco("TailLight", Vector3.new(1.2, 0.45, 0.2), CFrame.new(sx * (Wd / 2 - 0.9), 1.0 + H * 0.7, L / 2 + 0.06), Color3.fromRGB(255, 40, 40), Enum.Material.Neon)
		for _, sz in ipairs({ -1, 1 }) do
			deco("Wheel", Vector3.new(0.9, 2.2, 2.2), CFrame.new(sx * (Wd / 2 - 0.15), 1.1, sz * (L / 2 - 1.9)), Color3.fromRGB(25, 25, 28), nil, Enum.PartType.Cylinder)
			deco("Hub", Vector3.new(0.95, 1.1, 1.1), CFrame.new(sx * (Wd / 2 - 0.13), 1.1, sz * (L / 2 - 1.9)), Color3.fromRGB(200, 205, 215), Enum.Material.Metal, Enum.PartType.Cylinder)
		end
	end

	local seat = Instance.new("VehicleSeat")
	seat.Name = "DriveSeat"
	seat.Size = Vector3.new(2, 0.5, 2)
	seat.CFrame = cf * CFrame.new(-Wd / 4 + 0.1, 1.35, L * 0.1)
	seat.Transparency = 1; seat.CanCollide = false; seat.Massless = true
	seat.HeadsUpDisplay = false; seat.MaxSpeed = 0; seat.Torque = 0
	seat.TopSurface = Enum.SurfaceType.Smooth; seat.BottomSurface = Enum.SurfaceType.Smooth
	seat:SetAttribute("Car", true)
	seat.Parent = model
	weld(base, seat)
	local pseat = Instance.new("Seat")
	pseat.Name = "PassengerSeat"
	pseat.Size = Vector3.new(2, 0.5, 2)
	pseat.CFrame = cf * CFrame.new(Wd / 4 - 0.1, 1.35, L * 0.1)
	pseat.Transparency = 1; pseat.CanCollide = false; pseat.Massless = true
	pseat.Parent = model
	weld(base, pseat)

	model:SetAttribute("Speed", spec.Speed)
	model.PrimaryPart = base

	if display then
		for _, d in ipairs(model:GetDescendants()) do if d:IsA("BasePart") then d.Anchored = true end end
		seat.Disabled = true; pseat.Disabled = true
		model.Parent = opts.parent or CarsFolder
		return model
	end

	local _, yaw, _ = cf:ToEulerAnglesYXZ()
	local bv = Instance.new("BodyVelocity")
	bv.MaxForce = Vector3.new(80000, 0, 80000); bv.P = 4000; bv.Velocity = Vector3.new(0, 0, 0)
	bv.Parent = base
	local bg = Instance.new("BodyGyro")
	bg.MaxTorque = Vector3.new(400000, 400000, 400000); bg.P = 6000; bg.D = 500
	bg.CFrame = CFrame.Angles(0, yaw, 0)
	bg.Parent = base

	local prompt = Instance.new("ProximityPrompt")
	prompt.ActionText = "Drive"; prompt.ObjectText = spec.Name
	prompt.MaxActivationDistance = 12; prompt.RequiresLineOfSight = false; prompt.HoldDuration = 0
	prompt.Parent = seat
	prompt.Triggered:Connect(function(p)
		local _, hum = hrpOf(p)
		if hum and hum.Health > 0 and not seat.Occupant and not hum.SeatPart then seat:Sit(hum) end
	end)

	seat:GetPropertyChangedSignal("Occupant"):Connect(function()
		local hum = seat.Occupant
		prompt.Enabled = hum == nil
		if hum then
			local p = Players:GetPlayerFromCharacter(hum.Parent)
			if p then pcall(function() base:SetNetworkOwner(p) end) end
		else
			-- the driver got out: the server takes the car back and parks it facing the way it was pointing
			local _, y, _ = base.CFrame:ToEulerAnglesYXZ()
			bg.CFrame = CFrame.Angles(0, y, 0)
			bv.Velocity = Vector3.new(0, 0, 0)
			pcall(function() base:SetNetworkOwner(nil) end)
		end
	end)

	if opts.owner then model:SetAttribute("Owner", opts.owner.UserId) end
	model.Parent = CarsFolder
	pcall(function() base:SetNetworkOwner(nil) end)
	return model
end

local function roadSpotNear(pos)
	local best, cf = math.huge, nil
	local lo, hi = CityData.RoadMin + 24, CityData.RoadMax - 24
	for _, x in ipairs(CityData.RoadX) do
		local d = math.abs(pos.X - x)
		if d < best then best = d; cf = CFrame.new(x + 7, 0.3, math.clamp(pos.Z, lo, hi)) * CFrame.Angles(0, math.pi, 0) end
	end
	for _, z in ipairs(CityData.RoadZ) do
		local d = math.abs(pos.Z - z)
		if d < best then best = d; cf = CFrame.new(math.clamp(pos.X, lo, hi), 0.3, z - 7) * CFrame.Angles(0, -math.pi / 2, 0) end
	end
	return cf
end

local playerCars, lastSpawn = {}, {}
SpawnCar.OnServerEvent:Connect(function(p, id)
	local d = data[p]
	local spec = CarById[id]
	if not d or not spec or not d.cars[id] then return end
	if os.clock() - (lastSpawn[p] or 0) < 4 then Notify:FireClient(p, "One sec… your car is on its way") return end
	local hrp, hum = hrpOf(p)
	if not hrp or not hum then return end
	if hum.SeatPart then Notify:FireClient(p, "Get out of your car first") return end
	lastSpawn[p] = os.clock()
	if playerCars[p] then playerCars[p]:Destroy() end
	playerCars[p] = buildCar(spec, roadSpotNear(hrp.Position), { owner = p })
	Notify:FireClient(p, "🚗 Your " .. spec.Name .. " is parked on the nearest road")
end)

BuyCar.OnServerInvoke = function(p, id)
	local d = data[p]
	local spec = CarById[id]
	if not d or not spec then return false, "Unknown car" end
	if d.cars[id] then return false, "You already own it" end
	if d.cash < spec.Price then return false, "You need $" .. (spec.Price - d.cash) .. " more" end
	addCash(p, -spec.Price, "bought a " .. spec.Name)
	d.cars[id] = true
	syncCars(p)
	saveData(p)
	return true, "It's yours! Spawn it from the Garage."
end

-- showroom cars at Rival Motors, and free cars parked around town (anyone can hop in)
for i, cfv in ipairs(CityData.Showroom) do
	local spec = CityData.Cars[(i % #CityData.Cars) + 1]
	buildCar(spec, cfv, { display = true })
end
local cityCars = {}
local function spawnCityCars()
	for i, s in ipairs(CityData.ParkSpots) do
		local m = cityCars[i]
		if not m or not m.Parent or (m.PrimaryPart and m.PrimaryPart.Position.Y < -40) then
			if m then m:Destroy() end
			local spec = CityData.Cars[((i - 1) % 2) + 1]
			cityCars[i] = buildCar(spec, s, {})
		end
	end
end
spawnCityCars()
task.spawn(function()
	while true do
		task.wait(30)
		spawnCityCars()
		for p, m in pairs(playerCars) do
			if m.Parent and m.PrimaryPart and m.PrimaryPart.Position.Y < -40 then m:Destroy(); playerCars[p] = nil end
		end
	end
end)

---------------------------------------------------------------- delivery jobs
local jobs = {}
local function startJob(p)
	if jobs[p] then Notify:FireClient(p, "You already have a delivery — follow the yellow line!") return end
	local hrp = hrpOf(p)
	if not hrp then return end
	local spots = CityData.DeliverySpots
	local pick, tries = spots[math.random(#spots)], 0
	while (pick - hrp.Position).Magnitude < 180 and tries < 30 do pick = spots[math.random(#spots)]; tries = tries + 1 end
	local dist = (pick - hrp.Position).Magnitude
	local job = { pos = pick, pay = math.floor(60 + dist * 0.35), t = os.clock(), limit = math.floor(math.max(40, dist / 14 + 25)) }
	jobs[p] = job
	JobEv:FireClient(p, "start", pick, job.pay, job.limit)
end
JobEv.OnServerEvent:Connect(function(p, action)
	local job = jobs[p]
	if action == "arrive" and job then
		local hrp = hrpOf(p)
		if hrp and (Vector3.new(hrp.Position.X, 0, hrp.Position.Z) - Vector3.new(job.pos.X, 0, job.pos.Z)).Magnitude < 30 then
			local fast = os.clock() - job.t <= job.limit
			local pay = job.pay + (fast and math.floor(job.pay * 0.5) or 0)
			jobs[p] = nil
			local d = data[p]
			if d then d.jobs = d.jobs + 1; local ls = p:FindFirstChild("leaderstats"); if ls then ls.Deliveries.Value = d.jobs end end
			addCash(p, pay, fast and "fast delivery bonus!" or "delivery")
			JobEv:FireClient(p, "done", pay, fast)
		end
	elseif action == "cancel" then
		jobs[p] = nil
		JobEv:FireClient(p, "cancel")
	end
end)

local function addPrompt(part, action, object, fn)
	if not part then return end
	local pr = Instance.new("ProximityPrompt")
	pr.ActionText = action; pr.ObjectText = object
	pr.HoldDuration = 0.2; pr.MaxActivationDistance = 14; pr.RequiresLineOfSight = false
	pr.Parent = part
	pr.Triggered:Connect(fn)
end
addPrompt(prompts.Depot, "Start a delivery", "Delivery Depot", startJob)
addPrompt(prompts.Dealer, "Browse cars", "Rival Motors", function(p) OpenUI:FireClient(p, "garage") end)

---------------------------------------------------------------- houses
local houses, houseByName = {}, {}
local function houseText(h)
	if h.ownerName then return "🏠 " .. h.ownerName .. "'s House" end
	return "FOR SALE  $" .. CityData.HousePrice
end
local houseFolder = Map:FindFirstChild("Houses")
if houseFolder then
	for _, m in ipairs(houseFolder:GetChildren()) do
		local door = m:FindFirstChild("Door")
		local post = m:FindFirstChild("SignPost")
		if door and post then
			local h = { name = m.Name, model = m, door = door }
			local bb = Instance.new("BillboardGui")
			bb.Size = UDim2.fromOffset(220, 48); bb.StudsOffset = Vector3.new(0, 3, 0); bb.MaxDistance = 90; bb.Adornee = post
			local t = Instance.new("TextLabel")
			t.Size = UDim2.fromScale(1, 1); t.BackgroundColor3 = Color3.fromRGB(20, 25, 40); t.BackgroundTransparency = 0.2
			t.TextColor3 = Color3.new(1, 1, 1); t.Font = Enum.Font.FredokaOne; t.TextScaled = true
			local c = Instance.new("UICorner"); c.CornerRadius = UDim.new(0, 10); c.Parent = t
			t.Parent = bb; bb.Parent = post
			h.label = t
			t.Text = houseText(h)
			local pr = Instance.new("ProximityPrompt")
			pr.ActionText = "Buy house"; pr.ObjectText = "$" .. CityData.HousePrice
			pr.HoldDuration = 0.6; pr.MaxActivationDistance = 12; pr.RequiresLineOfSight = false
			pr.Parent = door
			h.prompt = pr
			table.insert(houses, h); houseByName[m.Name] = h
			pr.Triggered:Connect(function(p)
				local d = data[p]
				if not d or h.owner then return end
				if d.house and houseByName[d.house] and houseByName[d.house].owner == p.UserId then Notify:FireClient(p, "You already own a house!") return end
				if d.cash < CityData.HousePrice then Notify:FireClient(p, "You need $" .. (CityData.HousePrice - d.cash) .. " more for this house") return end
				addCash(p, -CityData.HousePrice, "bought a house! You'll respawn here")
				h.owner = p.UserId; h.ownerName = p.DisplayName; d.house = h.name
				t.Text = houseText(h); pr.Enabled = false
				saveData(p)
			end)
		end
	end
end
local function claimHouse(p)
	local d = data[p]
	if not d or not d.house then return end
	local h = houseByName[d.house]
	if not h or h.owner then
		h = nil
		for _, x in ipairs(houses) do if not x.owner then h = x; break end end
		if not h then return end
		d.house = h.name
	end
	h.owner = p.UserId; h.ownerName = p.DisplayName; h.label.Text = houseText(h); h.prompt.Enabled = false
end
local function releaseHouse(p)
	for _, h in ipairs(houses) do
		if h.owner == p.UserId then h.owner = nil; h.ownerName = nil; h.label.Text = houseText(h); h.prompt.Enabled = true end
	end
end
local function homeOf(p)
	for _, h in ipairs(houses) do if h.owner == p.UserId then return h end end
	return nil
end

---------------------------------------------------------------- cash coins around town
local function spawnCoin()
	local spots = CityData.CoinSpots
	local pos = spots[math.random(#spots)]
	local c = newPart(CoinsFolder, { Name = "Coin", Size = Vector3.new(0.5, 3, 3), Shape = Enum.PartType.Cylinder, Anchored = true, CanCollide = false,
		Color = Color3.fromRGB(255, 205, 40), Material = Enum.Material.Neon, CFrame = CFrame.new(pos + Vector3.new(0, 2.6, 0)) })
	local taken = false
	c.Touched:Connect(function(hit)
		if taken then return end
		local p = Players:GetPlayerFromCharacter(hit.Parent)
		if not p then
			local m = hit:FindFirstAncestorOfClass("Model")
			local seat = m and m:FindFirstChild("DriveSeat")
			if seat and seat.Occupant then p = Players:GetPlayerFromCharacter(seat.Occupant.Parent) end
		end
		if p then taken = true; c:Destroy(); addCash(p, 25, "cash pickup") end
	end)
end
task.spawn(function()
	while true do
		if #CoinsFolder:GetChildren() < 30 then spawnCoin() end
		task.wait(4)
	end
end)

---------------------------------------------------------------- teleport (phone map)
local lastTp = {}
Teleport.OnServerEvent:Connect(function(p, i)
	local place = CityData.Places[tonumber(i) or 0]
	local hrp, hum = hrpOf(p)
	if not place or not hrp or not hum then return end
	if hum.SeatPart then Notify:FireClient(p, "Get out of the car to use the map taxi") return end
	if os.clock() - (lastTp[p] or 0) < 6 then Notify:FireClient(p, "The taxi is on its way… try again in a few seconds") return end
	lastTp[p] = os.clock()
	if place.Home then
		local h = homeOf(p)
		if not h then Notify:FireClient(p, "You don't own a house yet — buy one in the Neighborhood") return end
		p.Character:PivotTo(h.door.CFrame * CFrame.new(0, 2, -7))
	else
		p.Character:PivotTo(CFrame.new(place.Pos + Vector3.new(0, 4, 0)))
	end
	Notify:FireClient(p, "🚕 Welcome to " .. place.Name)
end)

---------------------------------------------------------------- players
local function onPlayer(p)
	if data[p] then return end
	local d = loadData(p)
	data[p] = d
	local ls = Instance.new("Folder"); ls.Name = "leaderstats"
	local cash = Instance.new("IntValue"); cash.Name = "Cash"; cash.Value = d.cash; cash.Parent = ls
	local dl = Instance.new("IntValue"); dl.Name = "Deliveries"; dl.Value = d.jobs; dl.Parent = ls
	ls.Parent = p
	syncCars(p)
	claimHouse(p)
	p.CharacterAdded:Connect(function(c)
		local h = homeOf(p)
		if h then
			task.wait(0.4)
			if c.Parent then c:PivotTo(h.door.CFrame * CFrame.new(0, 2, -7)) end
		end
	end)
	task.delay(3, function() if p.Parent then Notify:FireClient(p, "Welcome to Rival City! Tap 📱 for cars, the map and jobs.") end end)
end
Players.PlayerAdded:Connect(onPlayer)
for _, p in ipairs(Players:GetPlayers()) do task.spawn(onPlayer, p) end   -- anyone who joined before this script started
Players.PlayerRemoving:Connect(function(p)
	saveData(p)
	releaseHouse(p)
	if playerCars[p] then playerCars[p]:Destroy(); playerCars[p] = nil end
	jobs[p] = nil; data[p] = nil; lastSpawn[p] = nil; lastTp[p] = nil
end)
game:BindToClose(function()
	for _, p in ipairs(Players:GetPlayers()) do saveData(p) end
	task.wait(1)
end)

-- payday every 5 minutes, and autosave
task.spawn(function()
	while true do
		task.wait(300)
		for _, p in ipairs(Players:GetPlayers()) do
			addCash(p, homeOf(p) and 200 or 100, homeOf(p) and "payday (homeowner bonus)" or "payday")
			saveData(p)
		end
	end
end)
