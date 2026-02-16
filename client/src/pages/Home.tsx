import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Thermometer, MapPin, TrendingUp, Users, Building2, Home as HomeIcon, Zap, DollarSign, Award, Phone, Mail, ArrowRight } from "lucide-react";
import { Link } from "wouter";

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative min-h-[600px] flex items-center overflow-hidden">
        <div 
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: `url('https://private-us-east-1.manuscdn.com/sessionFile/oQ7IQSkFt9czjfRNsaeheY/sandbox/Cad5vviVx27T90eT9ikUjI-img-1_1771207629000_na1fn_aGVyby1odmFjLWVzc2V4.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvb1E3SVFTa0Z0OWN6amZSTnNhZWhlWS9zYW5kYm94L0NhZDV2dmlWeDI3VDkwZVQ5aWtVakktaW1nLTFfMTc3MTIwNzYyOTAwMF9uYTFmbl9hR1Z5Ynkxb2RtRmpMV1Z6YzJWNC5wbmc~eC1vc3MtcHJvY2Vzcz1pbWFnZS9yZXNpemUsd18xOTIwLGhfMTkyMC9mb3JtYXQsd2VicC9xdWFsaXR5LHFfODAiLCJDb25kaXRpb24iOnsiRGF0ZUxlc3NUaGFuIjp7IkFXUzpFcG9jaFRpbWUiOjE3OTg3NjE2MDB9fX1dfQ__&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=lLwkW2FcuKMg4ROBJ9qRroXb7GCMaFA89o8x1obJlBuuKxwDhnL1mvKoXRXk~EUKf4VHM70Wqxy9rKKj10CUQPob4gyiMiqZsR89S0ROBxoe5vkOLsS4hvNI0vm~I4uZEpTVOf9eSk~5O6XZ7CYHHwBzlFNZxzDOa3~bXWzJKkVyabNF6LPX~ixWGtvWp4Mg9Exy~B95MXEcoMLJUs9sMDuO567SHyWDjnZgRA-Btbwf~Z8f6S-h318dS4-uYw7A2MqS4645JR9Ag2btvtxZKFufc~KOHBmrClhFmfO33fLI1~ms6pTVd97fj5RH4dPpp-IJK3VeKYKnoZ7rR~jXlg__')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-[#1e3a5f]/95 via-[#1e3a5f]/80 to-transparent"></div>
        </div>
        
        <div className="container relative z-10 py-20">
          <div className="max-w-3xl">
            <Badge className="mb-4 bg-[#ff6b35] text-white hover:bg-[#ff6b35]/90">15 Counties Across New Jersey</Badge>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
              HVAC Lead Generation Campaigns
            </h1>
            <p className="text-xl md:text-2xl text-white/90 mb-8 leading-relaxed">
              Strategic marketing campaigns designed to generate qualified leads for HVAC installations and replacements across 15 counties and 262+ municipalities in New Jersey.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/residential">
                <Button size="lg" className="bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white font-semibold">
                  Residential Campaigns <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/commercial">
                <Button size="lg" variant="outline" className="bg-white/10 backdrop-blur-sm text-white border-white hover:bg-white/20">
                  Commercial Campaigns <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Market Overview Stats */}
      <section className="py-16 bg-secondary/30">
        <div className="container">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="border-l-4 border-l-[#ff6b35]">
              <CardHeader className="pb-3">
                <CardTitle className="text-3xl font-bold text-[#1e3a5f]">6.2M+</CardTitle>
                <CardDescription className="text-base">Total Population</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Across 15 counties in New Jersey service area</p>
              </CardContent>
            </Card>
            
            <Card className="border-l-4 border-l-[#ff6b35]">
              <CardHeader className="pb-3">
                <CardTitle className="text-3xl font-bold text-[#1e3a5f]">262+</CardTitle>
                <CardDescription className="text-base">Municipalities Served</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Across 15 counties in Northern, Central & Southern NJ</p>
              </CardContent>
            </Card>
            
            <Card className="border-l-4 border-l-[#ff6b35]">
              <CardHeader className="pb-3">
                <CardTitle className="text-3xl font-bold text-[#1e3a5f]">2.2M</CardTitle>
                <CardDescription className="text-base">Electric Customers</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Plus 1.8M gas customers in service area</p>
              </CardContent>
            </Card>
            
            <Card className="border-l-4 border-l-[#ff6b35]">
              <CardHeader className="pb-3">
                <CardTitle className="text-3xl font-bold text-[#1e3a5f]">100K+</CardTitle>
                <CardDescription className="text-base">Commercial Properties</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Massive B2B opportunity across service area</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* PSEG Program Highlight - Featured Campaign */}
      <section className="py-20 bg-gradient-to-br from-[#1e3a5f] to-[#2a5a8f] text-white diagonal-divider">
        <div className="container">
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-[#ff6b35] text-white text-base px-4 py-2">🔥 Featured Programs</Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Heat Pump Incentive Programs</h2>
            <p className="text-xl text-white/90 max-w-3xl mx-auto">
              Up to $16K residential rebates and commercial incentives available across 15 New Jersey counties
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-center max-w-6xl mx-auto">
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="bg-[#ff6b35] p-3 rounded-lg">
                  <DollarSign className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Up to $16K Residential</h3>
                  <p className="text-white/80">Decarbonization Program for homeowners</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="bg-[#ff6b35] p-3 rounded-lg">
                  <Zap className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Up to 50% Energy Savings</h3>
                  <p className="text-white/80">Modern heat pumps dramatically reduce utility costs</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="bg-[#ff6b35] p-3 rounded-lg">
                  <Award className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Commercial Incentives</h3>
                  <p className="text-white/80">Direct Replacement Program for businesses</p>
                </div>
              </div>

              <Button size="lg" className="bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white font-semibold w-full md:w-auto">
                View Program Details <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>

            <Card className="bg-white/10 backdrop-blur-sm border-white/20">
              <CardHeader>
                <CardTitle className="text-white text-2xl">SEO Keywords Strategy</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-white/70 mb-2">Primary Keywords:</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="bg-white/20 text-white">heat pump rebates NJ</Badge>
                    <Badge variant="secondary" className="bg-white/20 text-white">residential decarbonization</Badge>
                    <Badge variant="secondary" className="bg-white/20 text-white">commercial direct replacement</Badge>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-white/70 mb-2">Long-tail Keywords:</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="bg-white/20 text-white text-xs">up to 16K heat pump rebate</Badge>
                    <Badge variant="secondary" className="bg-white/20 text-white text-xs">commercial HVAC incentives</Badge>
                    <Badge variant="secondary" className="bg-white/20 text-white text-xs">NJ 15 county heat pump</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Campaign Tiers */}
      <section className="py-20">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-[#1e3a5f] mb-4">Multi-Tier Campaign Strategy</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Targeted campaigns designed for specific market segments across Essex County's diverse municipalities
            </p>
          </div>

          <Tabs defaultValue="tier1" className="max-w-6xl mx-auto">
            <TabsList className="grid w-full grid-cols-1 md:grid-cols-4 h-auto gap-2">
              <TabsTrigger value="tier1" className="data-[state=active]:bg-[#1e3a5f] data-[state=active]:text-white py-3">
                Tier 1: Elite Comfort
              </TabsTrigger>
              <TabsTrigger value="tier2" className="data-[state=active]:bg-[#1e3a5f] data-[state=active]:text-white py-3">
                Tier 2: Reliable & Affordable
              </TabsTrigger>
              <TabsTrigger value="tier3" className="data-[state=active]:bg-[#1e3a5f] data-[state=active]:text-white py-3">
                Tier 3: Fast & Dependable
              </TabsTrigger>
              <TabsTrigger value="pseg" className="data-[state=active]:bg-[#ff6b35] data-[state=active]:text-white py-3">
                PSEG Program
              </TabsTrigger>
            </TabsList>

            <TabsContent value="tier1" className="mt-8">
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <img 
                    src="https://private-us-east-1.manuscdn.com/sessionFile/oQ7IQSkFt9czjfRNsaeheY/sandbox/Cad5vviVx27T90eT9ikUjI-img-2_1771207626000_na1fn_Y2FtcGFpZ24tdGllcjEtYWZmbHVlbnQ.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvb1E3SVFTa0Z0OWN6amZSTnNhZWhlWS9zYW5kYm94L0NhZDV2dmlWeDI3VDkwZVQ5aWtVakktaW1nLTJfMTc3MTIwNzYyNjAwMF9uYTFmbl9ZMkZ0Y0dGcFoyNHRkR2xsY2pFdFlXWm1iSFZsYm5RLnBuZz94LW9zcy1wcm9jZXNzPWltYWdlL3Jlc2l6ZSx3XzE5MjAsaF8xOTIwL2Zvcm1hdCx3ZWJwL3F1YWxpdHkscV84MCIsIkNvbmRpdGlvbiI6eyJEYXRlTGVzc1RoYW4iOnsiQVdTOkVwb2NoVGltZSI6MTc5ODc2MTYwMH19fV19&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=cHLSWNTf050jyc5Mr18yZxCYC8qOpDT-YzllSW1VuDbU~eROemVMc6hmFev3b1BvFTLe-0BkaWJLYSQrSw6gSFju-i4b7fqeYLOJPdVIfn2-FYlvUbmWO8Ykf9U47J4CvUNLf117xT526OV7YJW90NZNMPjLxjQTEMNgHYD~Od0zQeniyXDCUMUfE3yrP0iLn1XsQ0lF3~PJ3obhrbXpjhAXy7Cp2o2tgWmmyP7oLJyiWihGfbjqEDV~m77UFk91N~a3UtL9yuu3UyBqO9KLjdN40cxV4xjhTaEFME9R~YAOviOZXZkn33dSzuc9ep7NFuMpTgK4iLp0X58XhgXMAA__"
                    alt="Luxury HVAC installation"
                    className="w-full h-[400px] object-cover rounded-lg shadow-lg"
                  />
                </div>
                <div className="space-y-6">
                  <div>
                    <h3 className="text-2xl font-bold text-[#1e3a5f] mb-2">Elite Comfort Campaign</h3>
                    <p className="text-muted-foreground mb-4">Targeting affluent markets with premium HVAC solutions</p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <MapPin className="h-5 w-5 text-[#ff6b35]" />
                      <span className="font-medium">Target Areas:</span>
                    </div>
                    <p className="text-sm text-muted-foreground pl-8">
                      Bergen, Essex, Morris, Somerset Counties - Affluent suburbs across PSEG service area
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Users className="h-5 w-5 text-[#ff6b35]" />
                      <span className="font-medium">Demographics:</span>
                    </div>
                    <p className="text-sm text-muted-foreground pl-8">
                      High-income homeowners ($150k+), aged 40-65, homes valued at $750k+. Towns like Montclair, Livingston, Summit, Princeton. Quality-conscious, value reliability.
                    </p>
                  </div>

                  <div className="bg-secondary/50 p-4 rounded-lg">
                    <h4 className="font-semibold mb-2 text-[#1e3a5f]">Key Offers:</h4>
                    <ul className="space-y-1 text-sm">
                      <li>✓ Free smart thermostat with installation</li>
                      <li>✓ $500 rebate on high-efficiency systems</li>
                      <li>✓ Free indoor air quality assessment</li>
                    </ul>
                  </div>

                  <Button className="bg-[#1e3a5f] hover:bg-[#1e3a5f]/90 w-full">
                    View Full Campaign Details
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="tier2" className="mt-8">
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <img 
                    src="https://private-us-east-1.manuscdn.com/sessionFile/oQ7IQSkFt9czjfRNsaeheY/sandbox/Cad5vviVx27T90eT9ikUjI-img-3_1771207623000_na1fn_Y2FtcGFpZ24tdGllcjItc3VidXJiYW4.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvb1E3SVFTa0Z0OWN6amZSTnNhZWhlWS9zYW5kYm94L0NhZDV2dmlWeDI3VDkwZVQ5aWtVakktaW1nLTNfMTc3MTIwNzYyMzAwMF9uYTFmbl9ZMkZ0Y0dGcFoyNHRkR2xsY2pJdGMzVmlkWEppWVc0LnBuZz94LW9zcy1wcm9jZXNzPWltYWdlL3Jlc2l6ZSx3XzE5MjAsaF8xOTIwL2Zvcm1hdCx3ZWJwL3F1YWxpdHkscV84MCIsIkNvbmRpdGlvbiI6eyJEYXRlTGVzc1RoYW4iOnsiQVdTOkVwb2NoVGltZSI6MTc5ODc2MTYwMH19fV19&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=PlHrPTA0kQB3qUiE3gD-Ximj1lTDYoxQYkUgaZtwE6btb3BJ33vQp9-Q8d6PAEr9z-bQ7Wc~2~OBZChFAlR7Wy3AjcIhUWJWipAMNX9bsQQkFEFT2i-ObFU01wJhUvDbI5REmWc9W5o~qS1jC6NmlbHrxtnCSkHK4zh5T-3xwnpd39APRJl9k6uAUjoEoulr78~QanacDOcZClLUAUcNAkFCjwLJBRHiqTot68a1~dZitjMI5EgNIk7nH~iL25rdsQNvhY9BaHFlGLRPj5DH4n-GD9ZgXdFQvi2Sw6Id5jMz49ZP7yT1li47PXRe3jZNxErZG1Mi5L57Cgwo7UD26A__"
                    alt="Suburban family HVAC service"
                    className="w-full h-[400px] object-cover rounded-lg shadow-lg"
                  />
                </div>
                <div className="space-y-6">
                  <div>
                    <h3 className="text-2xl font-bold text-[#1e3a5f] mb-2">Reliable & Affordable Campaign</h3>
                    <p className="text-muted-foreground mb-4">Serving suburban families with trusted HVAC solutions</p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <MapPin className="h-5 w-5 text-[#ff6b35]" />
                      <span className="font-medium">Target Areas:</span>
                    </div>
                    <p className="text-sm text-muted-foreground pl-8">
                      Burlington, Camden, Middlesex, Mercer, Union Counties - Middle-class suburbs across PSEG territory
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <HomeIcon className="h-5 w-5 text-[#ff6b35]" />
                      <span className="font-medium">Demographics:</span>
                    </div>
                    <p className="text-sm text-muted-foreground pl-8">
                      Middle to upper-middle-class families, aged 35-55, homes valued at $400k-$750k. Towns like Edison, Hamilton, Cherry Hill. Budget-conscious but want reliability.
                    </p>
                  </div>

                  <div className="bg-secondary/50 p-4 rounded-lg">
                    <h4 className="font-semibold mb-2 text-[#1e3a5f]">Key Offers:</h4>
                    <ul className="space-y-1 text-sm">
                      <li>✓ 0% financing for 24 months</li>
                      <li>✓ $100 off any new installation</li>
                      <li>✓ Free service call with any repair</li>
                    </ul>
                  </div>

                  <Button className="bg-[#1e3a5f] hover:bg-[#1e3a5f]/90 w-full">
                    View Full Campaign Details
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="tier3" className="mt-8">
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <img 
                    src="https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800&h=600&fit=crop"
                    alt="Emergency HVAC service"
                    className="w-full h-[400px] object-cover rounded-lg shadow-lg"
                  />
                </div>
                <div className="space-y-6">
                  <div>
                    <h3 className="text-2xl font-bold text-[#1e3a5f] mb-2">Fast & Dependable Campaign</h3>
                    <p className="text-muted-foreground mb-4">24/7 emergency service for urban markets</p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <MapPin className="h-5 w-5 text-[#ff6b35]" />
                      <span className="font-medium">Target Areas:</span>
                    </div>
                    <p className="text-sm text-muted-foreground pl-8">
                      Hudson, Passaic, Essex, Camden Counties - Urban centers (Newark, Jersey City, Paterson, Camden)
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Building2 className="h-5 w-5 text-[#ff6b35]" />
                      <span className="font-medium">Demographics:</span>
                    </div>
                    <p className="text-sm text-muted-foreground pl-8">
                      Renters, landlords, and homeowners in dense urban environment. Need fast, dependable service when systems fail.
                    </p>
                  </div>

                  <div className="bg-secondary/50 p-4 rounded-lg">
                    <h4 className="font-semibold mb-2 text-[#1e3a5f]">Key Offers:</h4>
                    <ul className="space-y-1 text-sm">
                      <li>✓ 24/7 emergency service (no extra charge)</li>
                      <li>✓ Free estimates on all repairs</li>
                      <li>✓ Special discounts for landlords</li>
                    </ul>
                  </div>

                  <Button className="bg-[#1e3a5f] hover:bg-[#1e3a5f]/90 w-full">
                    View Full Campaign Details
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="pseg" className="mt-8">
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <img 
                    src="https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=800&h=600&fit=crop"
                    alt="Modern heat pump installation"
                    className="w-full h-[400px] object-cover rounded-lg shadow-lg"
                  />
                </div>
                <div className="space-y-6">
                  <div>
                    <Badge className="mb-2 bg-[#ff6b35] text-white">Zero Upfront Cost</Badge>
                    <h3 className="text-2xl font-bold text-[#1e3a5f] mb-2">PSEG Decarbonization Program</h3>
                    <p className="text-muted-foreground mb-4">Replace your HVAC system with $0 down payment</p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <MapPin className="h-5 w-5 text-[#ff6b35]" />
                      <span className="font-medium">Target Areas:</span>
                    </div>
                    <p className="text-sm text-muted-foreground pl-8">
                      All 15 counties across New Jersey - 262+ municipalities, residential and commercial
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Zap className="h-5 w-5 text-[#ff6b35]" />
                      <span className="font-medium">Program Benefits:</span>
                    </div>
                    <ul className="text-sm text-muted-foreground pl-8 space-y-1">
                      <li>• Up to $16,000 residential rebates</li>
                      <li>• Commercial incentives available</li>
                      <li>• Up to 50% energy savings</li>
                      <li>• Professional installation included</li>
                      <li>• Eco-friendly heat pump technology</li>
                    </ul>
                  </div>

                  <div className="bg-gradient-to-r from-[#ff6b35]/10 to-[#1e3a5f]/10 p-4 rounded-lg border border-[#ff6b35]/20">
                    <h4 className="font-semibold mb-2 text-[#1e3a5f]">SEO-Optimized Keywords:</h4>
                    <p className="text-xs text-muted-foreground mb-2">
                      heat pump rebates NJ, residential decarbonization program, commercial direct replacement, New Jersey HVAC, up to 16K residential, commercial HVAC incentives
                    </p>
                  </div>

                  <Button className="bg-[#ff6b35] hover:bg-[#ff6b35]/90 w-full text-white">
                    View Program Campaign Materials
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* Market Segmentation Map */}
      <section className="py-20 bg-secondary/30">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-[#1e3a5f] mb-4">Geographic Market Segmentation</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              15-county service area with 262+ municipalities strategically divided into four targeting tiers
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <img 
              src="https://private-us-east-1.manuscdn.com/sessionFile/oQ7IQSkFt9czjfRNsaeheY/sandbox/Cad5vviVx27T90eT9ikUjI-img-4_1771207623000_na1fn_ZXNzZXgtY291bnR5LW1hcC1hYnN0cmFjdA.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvb1E3SVFTa0Z0OWN6amZSTnNhZWhlWS9zYW5kYm94L0NhZDV2dmlWeDI3VDkwZVQ5aWtVakktaW1nLTRfMTc3MTIwNzYyMzAwMF9uYTFmbl9aWE56WlhndFkyOTFiblI1TFcxaGNDMWhZbk4wY21GamRBLnBuZz94LW9zcy1wcm9jZXNzPWltYWdlL3Jlc2l6ZSx3XzE5MjAsaF8xOTIwL2Zvcm1hdCx3ZWJwL3F1YWxpdHkscV84MCIsIkNvbmRpdGlvbiI6eyJEYXRlTGVzc1RoYW4iOnsiQVdTOkVwb2NoVGltZSI6MTc5ODc2MTYwMH19fV19&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=hHjmeSSLD4mLz5P09pTrTmmD~fwCF3~moNuSAoR77NTjfYU1TJXjUsCnFtvinTcU3f1L-kL0ghbr2jyBPeB4oDxRA~C0hK-6PU6MFTXXLbw3nwZBYCvs5QObcnw-C87SGlrYb0YroI0h5CyD3DeJXzt6vFtYf~748MpxbAMKgnqDZXZ5EsykKj9NPEYvHxPgMJWMjY0ZcU5lu~ut-kXgegM4WAu0EVdPwvd36RxOP5nEpf6AogcF5PwnWL2kB9qYIWP~L-LpK8LK45PQkqFZ7tMvHgTxFHMMQaIcD9z9w-In85khUbNUJVHcYI90MoWZfqrHtmpdhrZ6IgmpeXMJtg__"
              alt="Essex County market segmentation map"
              className="w-full rounded-lg shadow-xl"
            />
          </div>

          <div className="grid md:grid-cols-4 gap-6 mt-12 max-w-6xl mx-auto">
            <Card className="border-t-4 border-t-[#1e3a5f]">
              <CardHeader>
                <CardTitle className="text-lg">Tier 1: Affluent</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">Premium HVAC systems, high conversion rates</p>
                <p className="text-xs font-medium">Bergen, Essex, Morris, Somerset</p>
              </CardContent>
            </Card>

            <Card className="border-t-4 border-t-[#ff6b35]">
              <CardHeader>
                <CardTitle className="text-lg">Tier 2: Suburban</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">Volume opportunity, maintenance contracts</p>
                <p className="text-xs font-medium">Burlington, Camden, Middlesex, Mercer, Union</p>
              </CardContent>
            </Card>

            <Card className="border-t-4 border-t-green-600">
              <CardHeader>
                <CardTitle className="text-lg">Tier 3: Urban</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">Emergency repairs, rental properties</p>
                <p className="text-xs font-medium">Hudson, Passaic, Urban Essex, Camden</p>
              </CardContent>
            </Card>

            <Card className="border-t-4 border-t-purple-600">
              <CardHeader>
                <CardTitle className="text-lg">Tier 4: Small Borough</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">Niche targeting, community focus</p>
                <p className="text-xs font-medium">Gloucester, Hunterdon, Monmouth, Ocean</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Marketing Channels Overview */}
      <section className="py-20">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-[#1e3a5f] mb-4">Multi-Channel Marketing Approach</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Integrated digital and traditional marketing strategies for maximum reach and ROI
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <Card>
              <CardHeader>
                <div className="bg-[#1e3a5f] w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
                <CardTitle>Digital Marketing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm">✓ Google Local Services Ads</p>
                <p className="text-sm">✓ Facebook & Instagram Ads</p>
                <p className="text-sm">✓ SEO-Optimized Landing Pages</p>
                <p className="text-sm">✓ Email Marketing Campaigns</p>
                <p className="text-sm">✓ YouTube Video Ads</p>
                <p className="text-sm">✓ Nextdoor Community Posts</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="bg-[#ff6b35] w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                  <Mail className="h-6 w-6 text-white" />
                </div>
                <CardTitle>Traditional Marketing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm">✓ Direct Mail Postcards</p>
                <p className="text-sm">✓ Yard Signs & Door Hangers</p>
                <p className="text-sm">✓ Local Radio Advertising</p>
                <p className="text-sm">✓ Bus & Transit Ads</p>
                <p className="text-sm">✓ Community Sponsorships</p>
                <p className="text-sm">✓ Home & Garden Shows</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="bg-green-600 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                  <Thermometer className="h-6 w-6 text-white" />
                </div>
                <CardTitle>Content Marketing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm">✓ Educational Blog Posts</p>
                <p className="text-sm">✓ Video Testimonials</p>
                <p className="text-sm">✓ How-To Guides</p>
                <p className="text-sm">✓ Social Media Content</p>
                <p className="text-sm">✓ Customer Success Stories</p>
                <p className="text-sm">✓ Seasonal Maintenance Tips</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-[#1e3a5f] to-[#2a5a8f] text-white diagonal-divider-bottom">
        <div className="container text-center">
              <h2 className="text-4xl md:text-5xl font-bold mb-6">Ready to Generate More HVAC Leads?</h2>
              <p className="text-xl text-white/90 mb-8 max-w-3xl mx-auto">
                These comprehensive campaigns are designed to drive qualified leads for HVAC installations and replacements across 15 counties and 262+ municipalities in New Jersey.
              </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Button size="lg" className="bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white font-semibold">
              <Phone className="mr-2 h-5 w-5" />
              Contact Us
            </Button>
            <Button size="lg" variant="outline" className="bg-white/10 backdrop-blur-sm text-white border-white hover:bg-white/20">
              <Mail className="mr-2 h-5 w-5" />
              Request Campaign Materials
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-[#1e3a5f] text-white">
        <div className="container">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-xl font-bold mb-4">HVAC Lead Generation</h3>
              <p className="text-white/70 text-sm">
                Comprehensive marketing campaigns for mechanical enterprises across 15 New Jersey counties.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Campaign Tiers</h4>
              <ul className="space-y-2 text-sm text-white/70">
                <li>Elite Comfort (Affluent Markets)</li>
                <li>Reliable & Affordable (Suburban)</li>
                <li>Fast & Dependable (Urban)</li>
                <li>Heat Pump Incentive Programs</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Service Area</h4>
              <p className="text-sm text-white/70">
                15 counties across Northern, Central, and Southern NJ including Bergen, Essex, Hudson, Middlesex, Morris, Passaic, Somerset, Union, Burlington, Camden, and more.
              </p>
            </div>
          </div>
          <div className="border-t border-white/20 mt-8 pt-8 text-center text-sm text-white/70">
            <p>© 2026 HVAC Lead Generation Campaigns - New Jersey. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
