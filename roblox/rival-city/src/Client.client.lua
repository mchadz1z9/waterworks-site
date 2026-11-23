-- Rival City (Roblox edition) — client: HUD, phone, driving, delivery guide
local Players = game:GetService("Players")
local RS = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")

local player = Players.LocalPlayer
local CityData = require(RS:WaitForChild("CityData"))
local Remotes = RS:WaitForChild("Remotes")
local Notify = Remotes:WaitForChild("Notify")
local SpawnCar = Remotes:WaitForChild("SpawnCar")
local BuyCar = Remotes:WaitForChild("BuyCar")
local JobEv = Remotes:WaitForChild("Job")
local Teleport = Remotes:WaitForChild("Teleport")
local OpenUI = Remotes:WaitForChild("OpenUI")

---------------------------------------------------------------- tiny UI helpers
local function make(class, props, parent)
	local o = Instance.new(class)
	for k, v in pairs(props) do o[k] = v end
	o.Parent = parent
	return o
end
local function round(o, r) make("UICorner", { CornerRadius = UDim.new(0, r or 12) }, o) end
local function border(o, color, th) make("UIStroke", { Color = color or Color3.new(0, 0, 0), Thickness = th or 2, Transparency = 0.15, ApplyStrokeMode = Enum.ApplyStrokeMode.Border }, o) end
local function money(n)
	local s = tostring(math.floor(n))
	local out = s:reverse():gsub("(%d%d%d)", "%1,"):reverse()
	if out:sub(1, 1) == "," then out = out:sub(2) end
	return "$" .. out
end
local FONT = Enum.Font.FredokaOne
local GREEN = Color3.fromRGB(70, 200, 95)
local BLUE = Color3.fromRGB(60, 140, 255)
local DARK = Color3.fromRGB(24, 28, 40)

local gui = make("ScreenGui", { Name = "RivalCityHUD", ResetOnSpawn = false, ZIndexBehavior = Enum.ZIndexBehavior.Sibling }, player:WaitForChild("PlayerGui"))

-- cash in the top-left
local cashLbl = make("TextLabel", { Size = UDim2.fromOffset(240, 46), Position = UDim2.fromOffset(14, 8), BackgroundTransparency = 1, Font = FONT, TextSize = 38,
	TextColor3 = Color3.fromRGB(120, 255, 140), TextXAlignment = Enum.TextXAlignment.Left, Text = "$0" }, gui)
make("UIStroke", { Thickness = 2.5, Color = Color3.fromRGB(0, 60, 20) }, cashLbl)
local function hookCash()
	local ls = player:WaitForChild("leaderstats")
	local cash = ls:WaitForChild("Cash")
	local function upd() cashLbl.Text = money(cash.Value) end
	cash.Changed:Connect(upd); upd()
end
task.spawn(hookCash)

-- toasts at the top
local toastBox = make("Frame", { Size = UDim2.new(0, 460, 0, 200), Position = UDim2.new(0.5, -230, 0, 10), BackgroundTransparency = 1 }, gui)
make("UIListLayout", { Padding = UDim.new(0, 6), HorizontalAlignment = Enum.HorizontalAlignment.Center, SortOrder = Enum.SortOrder.LayoutOrder }, toastBox)
local toastN = 0
local function toast(text, kind)
	toastN = toastN + 1
	local t = make("TextLabel", { Size = UDim2.new(1, 0, 0, 40), BackgroundColor3 = kind == "cash" and Color3.fromRGB(30, 120, 55) or DARK, BackgroundTransparency = 0.1,
		Font = FONT, TextSize = 22, TextColor3 = Color3.new(1, 1, 1), Text = text, TextWrapped = true, LayoutOrder = toastN }, toastBox)
	round(t, 12)
	task.delay(3.2, function()
		TweenService:Create(t, TweenInfo.new(0.4), { BackgroundTransparency = 1, TextTransparency = 1 }):Play()
		task.wait(0.45); t:Destroy()
	end)
end
Notify.OnClientEvent:Connect(toast)

-- speedometer while driving
local speedo = make("Frame", { Size = UDim2.fromOffset(230, 70), Position = UDim2.new(0.5, -115, 1, -96), BackgroundColor3 = DARK, BackgroundTransparency = 0.15, Visible = false }, gui)
round(speedo, 16)
local speedLbl = make("TextLabel", { Size = UDim2.new(1, 0, 0, 46), BackgroundTransparency = 1, Font = FONT, TextSize = 36, TextColor3 = Color3.new(1, 1, 1), Text = "0 km/h" }, speedo)
make("TextLabel", { Size = UDim2.new(1, 0, 0, 20), Position = UDim2.fromOffset(0, 46), BackgroundTransparency = 1, Font = FONT, TextSize = 15, TextColor3 = Color3.fromRGB(170, 180, 200), Text = "W/S drive · A/D steer · Space get out" }, speedo)

-- delivery status
local jobBar = make("TextLabel", { Size = UDim2.fromOffset(330, 40), Position = UDim2.fromOffset(14, 58), BackgroundColor3 = Color3.fromRGB(150, 100, 0), BackgroundTransparency = 0.1,
	Font = FONT, TextSize = 19, TextColor3 = Color3.new(1, 1, 1), Visible = false, Text = "" }, gui)
round(jobBar, 12)

---------------------------------------------------------------- phone
local phoneBtn = make("TextButton", { Size = UDim2.fromOffset(78, 78), Position = UDim2.new(1, -96, 0.5, -120), BackgroundColor3 = BLUE, Font = FONT, TextSize = 40, Text = "📱", TextColor3 = Color3.new(1, 1, 1), AutoButtonColor = true }, gui)
round(phoneBtn, 22); border(phoneBtn, Color3.new(1, 1, 1), 3)
local phone = make("Frame", { Size = UDim2.fromOffset(360, 480), Position = UDim2.new(1, -470, 0.5, -240), BackgroundColor3 = Color3.fromRGB(18, 22, 34), Visible = false }, gui)
round(phone, 26); border(phone, Color3.fromRGB(80, 90, 120), 3)
make("UISizeConstraint", { MaxSize = Vector2.new(360, 480) }, phone)
local head = make("TextLabel", { Size = UDim2.new(1, -60, 0, 44), Position = UDim2.fromOffset(18, 10), BackgroundTransparency = 1, Font = FONT, TextSize = 26, TextColor3 = Color3.new(1, 1, 1), TextXAlignment = Enum.TextXAlignment.Left, Text = "Rival Phone" }, phone)
local closeBtn = make("TextButton", { Size = UDim2.fromOffset(40, 40), Position = UDim2.new(1, -52, 0, 12), BackgroundColor3 = Color3.fromRGB(220, 70, 70), Font = FONT, TextSize = 22, Text = "X", TextColor3 = Color3.new(1, 1, 1) }, phone)
round(closeBtn, 20)
local tabs = make("Frame", { Size = UDim2.new(1, -24, 0, 44), Position = UDim2.fromOffset(12, 60), BackgroundTransparency = 1 }, phone)
make("UIListLayout", { FillDirection = Enum.FillDirection.Horizontal, Padding = UDim.new(0, 6) }, tabs)
local body = make("ScrollingFrame", { Size = UDim2.new(1, -24, 1, -120), Position = UDim2.fromOffset(12, 112), BackgroundTransparency = 1, ScrollBarThickness = 6,
	CanvasSize = UDim2.new(), AutomaticCanvasSize = Enum.AutomaticSize.Y, BorderSizePixel = 0 }, phone)
make("UIListLayout", { Padding = UDim.new(0, 8), SortOrder = Enum.SortOrder.LayoutOrder }, body)

local function clearBody() for _, c in ipairs(body:GetChildren()) do if not c:IsA("UIListLayout") then c:Destroy() end end end
local function row(h) local f = make("Frame", { Size = UDim2.new(1, -8, 0, h or 64), BackgroundColor3 = Color3.fromRGB(34, 40, 58) }, body); round(f, 14); return f end
local function button(parent, text, color, size, pos, fn)
	local b = make("TextButton", { Size = size, Position = pos, BackgroundColor3 = color, Font = FONT, TextSize = 18, Text = text, TextColor3 = Color3.new(1, 1, 1), AutoButtonColor = true }, parent)
	round(b, 12)
	b.Activated:Connect(fn)
	return b
end
local function label(parent, text, size, pos, ts, col, align)
	return make("TextLabel", { Size = size, Position = pos, BackgroundTransparency = 1, Font = FONT, TextSize = ts or 18, TextColor3 = col or Color3.new(1, 1, 1),
		Text = text, TextXAlignment = align or Enum.TextXAlignment.Left, TextWrapped = true }, parent)
end

local current = "garage"
local job = nil
local render

local function owned(id)
	local s = "," .. (player:GetAttribute("Cars") or "") .. ","
	return s:find("," .. id .. ",", 1, true) ~= nil
end

local pages = {}
pages.garage = function()
	head.Text = "🚗 Garage"
	for _, c in ipairs(CityData.Cars) do
		local f = row(70)
		local sw = make("Frame", { Size = UDim2.fromOffset(16, 46), Position = UDim2.fromOffset(10, 12), BackgroundColor3 = c.Color }, f); round(sw, 6)
		label(f, c.Name, UDim2.new(1, -160, 0, 28), UDim2.fromOffset(34, 8), 20)
		label(f, "Top speed " .. math.floor(c.Speed * 1.6) .. " km/h", UDim2.new(1, -160, 0, 22), UDim2.fromOffset(34, 38), 15, Color3.fromRGB(160, 170, 195))
		if owned(c.Id) then
			button(f, "Spawn", GREEN, UDim2.fromOffset(104, 44), UDim2.new(1, -114, 0, 13), function() SpawnCar:FireServer(c.Id); phone.Visible = false end)
		else
			button(f, money(c.Price), BLUE, UDim2.fromOffset(104, 44), UDim2.new(1, -114, 0, 13), function()
				local ok, msg = BuyCar:InvokeServer(c.Id)
				toast(msg, ok and "cash" or nil)
				task.wait(0.2); render()
			end)
		end
	end
end
pages.map = function()
	head.Text = "🗺️ Map taxi"
	for i, pl in ipairs(CityData.Places) do
		local f = row(56)
		label(f, pl.Icon .. "  " .. pl.Name, UDim2.new(1, -130, 1, 0), UDim2.fromOffset(14, 0), 20)
		button(f, "Go", BLUE, UDim2.fromOffset(90, 40), UDim2.new(1, -100, 0, 8), function() Teleport:FireServer(i); phone.Visible = false end)
	end
end
pages.jobs = function()
	head.Text = "📦 Jobs"
	local f = row(120)
	if job then
		label(f, "Current delivery: " .. money(job.pay) .. " (+50% if you make it in " .. job.limit .. " s). Follow the yellow line to the glowing marker.", UDim2.new(1, -20, 0, 70), UDim2.fromOffset(10, 6), 17)
		button(f, "Cancel delivery", Color3.fromRGB(200, 70, 70), UDim2.fromOffset(170, 36), UDim2.fromOffset(10, 78), function() JobEv:FireServer("cancel") end)
	else
		label(f, "Go to the Delivery Depot and press E at the desk to get a package. Drive it to the marker for cash. Faster = bonus!", UDim2.new(1, -20, 0, 70), UDim2.fromOffset(10, 6), 17)
		button(f, "Taxi to the Depot", BLUE, UDim2.fromOffset(180, 36), UDim2.fromOffset(10, 78), function()
			for i, pl in ipairs(CityData.Places) do if pl.Name == "Delivery Depot" then Teleport:FireServer(i) end end
			phone.Visible = false
		end)
	end
	local g = row(70)
	label(g, "💰 Gold coins around town are worth $25. Everyone gets a payday every 5 minutes — homeowners get double.", UDim2.new(1, -20, 1, -8), UDim2.fromOffset(10, 4), 16, Color3.fromRGB(200, 210, 230))
end
pages.help = function()
	head.Text = "❓ How to play"
	local lines = {
		"🚶 Walk with WASD, jump with Space.",
		"🚗 Press E near a car to drive it (or walk into the seat). W/S gas and brake, A/D steer, Space to hop out.",
		"🛒 Buy faster cars here in the Garage or at Rival Motors.",
		"🏠 Houses in the Neighborhood cost " .. money(CityData.HousePrice) .. ". Owning one means you respawn at home and get double payday.",
		"🌊 The ocean is real water — go for a swim at the beach!",
		"💾 Your cash, cars and house are saved.",
	}
	for _, s in ipairs(lines) do local f = row(64); label(f, s, UDim2.new(1, -20, 1, -8), UDim2.fromOffset(10, 4), 16) end
end

local tabBtns = {}
for _, t in ipairs({ { "garage", "🚗" }, { "map", "🗺️" }, { "jobs", "📦" }, { "help", "❓" } }) do
	local b = make("TextButton", { Size = UDim2.fromOffset(78, 44), BackgroundColor3 = Color3.fromRGB(40, 48, 70), Font = FONT, TextSize = 24, Text = t[2], TextColor3 = Color3.new(1, 1, 1) }, tabs)
	round(b, 12)
	tabBtns[t[1]] = b
	b.Activated:Connect(function() current = t[1]; render() end)
end
render = function()
	clearBody()
	for k, b in pairs(tabBtns) do b.BackgroundColor3 = k == current and BLUE or Color3.fromRGB(40, 48, 70) end
	pages[current]()
end
local function openPhone(tab)
	if tab then current = tab end
	phone.Visible = true
	render()
end
phoneBtn.Activated:Connect(function() if phone.Visible then phone.Visible = false else openPhone() end end)
closeBtn.Activated:Connect(function() phone.Visible = false end)
OpenUI.OnClientEvent:Connect(function(tab) openPhone(tab) end)
player:GetAttributeChangedSignal("Cars"):Connect(function() if phone.Visible and current == "garage" then render() end end)

---------------------------------------------------------------- delivery marker + guide line
local marker, beam, att0, att1, arriveSent = nil, nil, nil, nil, false
local function clearMarker()
	if marker then marker:Destroy(); marker = nil end
	if att0 then att0:Destroy(); att0 = nil end
	beam = nil; att1 = nil
	jobBar.Visible = false
end
JobEv.OnClientEvent:Connect(function(action, a, b, c)
	if action == "start" then
		clearMarker()
		job = { pos = a, pay = b, limit = c, t0 = os.clock() }
		arriveSent = false
		marker = make("Part", { Name = "DeliveryMarker", Anchored = true, CanCollide = false, CanQuery = false, CanTouch = false, Shape = Enum.PartType.Cylinder,
			Size = Vector3.new(80, 12, 12), CFrame = CFrame.new(a + Vector3.new(0, 40, 0)) * CFrame.Angles(0, 0, math.pi / 2),
			Color = Color3.fromRGB(255, 215, 0), Material = Enum.Material.Neon, Transparency = 0.45 }, workspace)
		att1 = make("Attachment", { Position = Vector3.new(-38, 0, 0) }, marker)
		local bb = make("BillboardGui", { Size = UDim2.fromOffset(200, 60), AlwaysOnTop = true, StudsOffsetWorldSpace = Vector3.new(0, 46, 0), Adornee = marker }, marker)
		make("TextLabel", { Name = "L", Size = UDim2.fromScale(1, 1), BackgroundTransparency = 1, Font = FONT, TextScaled = true, TextColor3 = Color3.fromRGB(255, 230, 90), TextStrokeTransparency = 0.3, Text = "📦 Deliver here" }, bb)
		toast("📦 New delivery: " .. money(b) .. " — follow the yellow line!")
		if phone.Visible and current == "jobs" then render() end
	elseif action == "done" then
		clearMarker(); job = nil
		toast(b and "⚡ Fast delivery! " .. money(a) or "✅ Delivered! " .. money(a), "cash")
		if phone.Visible and current == "jobs" then render() end
	elseif action == "cancel" then
		clearMarker(); job = nil
		toast("Delivery cancelled")
		if phone.Visible and current == "jobs" then render() end
	end
end)

---------------------------------------------------------------- driving (runs on the driver's computer, which owns the car's physics)
local curCar, speed, yaw, stuckT = nil, 0, 0, 0
RunService.RenderStepped:Connect(function(dt)
	local char = player.Character
	local hum = char and char:FindFirstChildOfClass("Humanoid")
	local hrp = char and char:FindFirstChild("HumanoidRootPart")
	local seat = hum and hum.SeatPart
	local driving = seat and seat:IsA("VehicleSeat") and seat:GetAttribute("Car")

	if driving then
		local car = seat.Parent
		local base = car and car:FindFirstChild("Base")
		local bv = base and base:FindFirstChildOfClass("BodyVelocity")
		local bg = base and base:FindFirstChildOfClass("BodyGyro")
		if bv and bg then
			if car ~= curCar then
				curCar = car; speed = 0; stuckT = 0
				local _, y, _ = base.CFrame:ToEulerAnglesYXZ()
				yaw = y
			end
			local maxS = car:GetAttribute("Speed") or 70
			local th, st = seat.ThrottleFloat, seat.SteerFloat
			if th > 0 then
				if speed < 0 then speed = math.min(0, speed + maxS * 2.2 * dt) else speed = math.min(maxS, speed + maxS * (0.55 - 0.3 * speed / maxS) * dt) end
			elseif th < 0 then
				if speed > 0 then speed = math.max(0, speed - maxS * 1.6 * dt) else speed = math.max(-maxS * 0.35, speed - maxS * 0.5 * dt) end
			else
				local drag = 10 * dt
				if math.abs(speed) <= drag then speed = 0 else speed = speed - drag * math.sign(speed) end
			end
			-- steering gets gentler at high speed; reversing steers the other way like a real car
			local grip = math.clamp(math.abs(speed) / 18, 0, 1) * (1 - 0.35 * math.abs(speed) / maxS)
			yaw = yaw - st * 2.1 * grip * dt * math.sign(speed + 0.001)
			bg.CFrame = CFrame.Angles(0, yaw, 0)
			bv.Velocity = CFrame.Angles(0, yaw, 0).LookVector * speed
			-- ran into a wall: lose the speed instead of grinding against it
			local real = base.AssemblyLinearVelocity
			local horiz = Vector3.new(real.X, 0, real.Z).Magnitude
			if math.abs(speed) > 12 and horiz < math.abs(speed) * 0.35 then stuckT = stuckT + dt else stuckT = 0 end
			if stuckT > 0.25 then speed = speed * 0.3; stuckT = 0 end
			speedo.Visible = true
			speedLbl.Text = math.floor(math.abs(speed) * 1.6 + 0.5) .. " km/h"
		end
	else
		curCar = nil
		speedo.Visible = false
	end

	-- delivery: guide line from you to the marker, distance, timer, and arrival check
	if job and marker and hrp then
		if not att0 or att0.Parent ~= hrp then
			if att0 then att0:Destroy() end
			att0 = make("Attachment", { Name = "JobAtt" }, hrp)
			beam = make("Beam", { Attachment0 = att0, Attachment1 = att1, Width0 = 0.6, Width1 = 0.6, FaceCamera = true, Color = ColorSequence.new(Color3.fromRGB(255, 220, 40)),
				LightEmission = 1, Transparency = NumberSequence.new(0.2), Segments = 1 }, marker)
		end
		local flat = Vector3.new(hrp.Position.X, 0, hrp.Position.Z) - Vector3.new(job.pos.X, 0, job.pos.Z)
		local dist = flat.Magnitude
		local left = math.max(0, job.limit - (os.clock() - job.t0))
		jobBar.Visible = true
		jobBar.Text = "📦 " .. money(job.pay) .. " · " .. math.floor(dist) .. " studs · " .. (left > 0 and ("bonus " .. math.ceil(left) .. "s") or "no bonus")
		local L = marker:FindFirstChildOfClass("BillboardGui")
		if L and L:FindFirstChild("L") then L.L.Text = "📦 Deliver here · " .. math.floor(dist) end
		if dist < 18 and not arriveSent then
			arriveSent = true
			JobEv:FireServer("arrive")
			task.delay(2, function() arriveSent = false end)
		end
	end

	-- spin the coins (just a local effect)
	local coins = workspace:FindFirstChild("Coins")
	if coins then
		for _, c in ipairs(coins:GetChildren()) do
			if c:IsA("BasePart") then c.CFrame = CFrame.new(c.Position) * CFrame.Angles(0, dt * 2.5, 0) * (c.CFrame - c.Position) end
		end
	end
end)
