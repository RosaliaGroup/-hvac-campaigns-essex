import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { campaignTemplates, platformLinks, platformInstructions, CampaignTemplate } from "@/data/campaignTemplates";
import { directInstallCampaigns } from "@/data/directInstallCampaigns";
import { ExternalLink, Copy, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export default function CampaignLibrary() {
  const [selectedTemplate, setSelectedTemplate] = useState<CampaignTemplate | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    toast.success(`${fieldName} copied to clipboard!`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'emergency': return 'bg-red-100 text-red-800';
      case 'installation': return 'bg-blue-100 text-blue-800';
      case 'maintenance': return 'bg-green-100 text-green-800';
      case 'rebates': return 'bg-purple-100 text-purple-800';
      case 'commercial': return 'bg-indigo-100 text-indigo-800';
      case 'partnerships': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPlatformColor = (platform: string) => {
    switch (platform) {
      case 'google-search': return 'bg-yellow-100 text-yellow-800';
      case 'google-business': return 'bg-yellow-100 text-yellow-800';
      case 'facebook': return 'bg-blue-100 text-blue-800';
      case 'instagram': return 'bg-pink-100 text-pink-800';
      case 'youtube': return 'bg-red-100 text-red-800';
      case 'nextdoor': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Convert directInstallCampaigns to CampaignTemplate format for unified display
  const diTemplates: CampaignTemplate[] = directInstallCampaigns.map((c) => ({
    id: `di-${c.id}`,
    name: c.name,
    category: 'lighting' as const,
    platform: 'google-search' as const,
    adType: 'Search Ad',
    content: {
      headline: c.headline_1,
      headline2: c.headline_2,
      headline3: c.headline_3,
      description: c.description_1,
      description2: c.description_2,
      cta: 'Free Assessment',
    },
    targetAudience: c.audience,
    estimatedBudget: `$${Math.round(c.budget_monthly / 30)}/day`,
  }));

  const allCampaigns = [...campaignTemplates, ...diTemplates];

  const filterByCategory = (category: string) => {
    if (category === 'all') return allCampaigns;
    return allCampaigns.filter(t => t.category === category);
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="flex flex-wrap gap-1">
          <TabsTrigger value="all">All ({allCampaigns.length})</TabsTrigger>
          <TabsTrigger value="emergency">Emergency</TabsTrigger>
          <TabsTrigger value="installation">Installation</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          <TabsTrigger value="rebates">Rebates</TabsTrigger>
          <TabsTrigger value="commercial">Commercial</TabsTrigger>
          <TabsTrigger value="nonprofit">Nonprofit</TabsTrigger>
          <TabsTrigger value="lighting">Lighting/DI</TabsTrigger>
          <TabsTrigger value="partnerships">Partners</TabsTrigger>
          <TabsTrigger value="nextdoor">Nextdoor</TabsTrigger>
        </TabsList>

        {['all', 'emergency', 'installation', 'maintenance', 'rebates', 'commercial', 'nonprofit', 'lighting', 'partnerships', 'nextdoor'].map(category => (
          <TabsContent key={category} value={category} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              {filterByCategory(category).map(template => (
                <Card key={template.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between mb-2">
                      <div className="space-y-2">
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                        <CardDescription>{template.adType}</CardDescription>
                      </div>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            size="sm" 
                            className="bg-[#ff6b35] hover:bg-[#ff6b35]/90"
                            onClick={() => setSelectedTemplate(template)}
                          >
                            View Details
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>{template.name}</DialogTitle>
                            <DialogDescription>
                              {template.adType} • {template.platform}
                            </DialogDescription>
                          </DialogHeader>

                          <div className="space-y-6">
                            {/* Ad Content */}
                            <div className="space-y-4">
                              <h3 className="font-semibold text-lg">Ad Copy</h3>
                              
                              {template.content.headline && (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <label className="text-sm font-medium">Headline 1</label>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => copyToClipboard(template.content.headline!, 'Headline 1')}
                                    >
                                      {copiedField === 'Headline 1' ? (
                                        <CheckCircle className="h-4 w-4 text-green-600" />
                                      ) : (
                                        <Copy className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </div>
                                  <div className="p-3 bg-secondary rounded-md text-sm">
                                    {template.content.headline}
                                  </div>
                                </div>
                              )}

                              {template.content.headline2 && (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <label className="text-sm font-medium">Headline 2</label>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => copyToClipboard(template.content.headline2!, 'Headline 2')}
                                    >
                                      {copiedField === 'Headline 2' ? (
                                        <CheckCircle className="h-4 w-4 text-green-600" />
                                      ) : (
                                        <Copy className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </div>
                                  <div className="p-3 bg-secondary rounded-md text-sm">
                                    {template.content.headline2}
                                  </div>
                                </div>
                              )}

                              {template.content.headline3 && (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <label className="text-sm font-medium">Headline 3</label>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => copyToClipboard(template.content.headline3!, 'Headline 3')}
                                    >
                                      {copiedField === 'Headline 3' ? (
                                        <CheckCircle className="h-4 w-4 text-green-600" />
                                      ) : (
                                        <Copy className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </div>
                                  <div className="p-3 bg-secondary rounded-md text-sm">
                                    {template.content.headline3}
                                  </div>
                                </div>
                              )}

                              {template.content.description && (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <label className="text-sm font-medium">Description 1</label>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => copyToClipboard(template.content.description!, 'Description 1')}
                                    >
                                      {copiedField === 'Description 1' ? (
                                        <CheckCircle className="h-4 w-4 text-green-600" />
                                      ) : (
                                        <Copy className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </div>
                                  <div className="p-3 bg-secondary rounded-md text-sm">
                                    {template.content.description}
                                  </div>
                                </div>
                              )}

                              {template.content.description2 && (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <label className="text-sm font-medium">Description 2</label>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => copyToClipboard(template.content.description2!, 'Description 2')}
                                    >
                                      {copiedField === 'Description 2' ? (
                                        <CheckCircle className="h-4 w-4 text-green-600" />
                                      ) : (
                                        <Copy className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </div>
                                  <div className="p-3 bg-secondary rounded-md text-sm">
                                    {template.content.description2}
                                  </div>
                                </div>
                              )}

                              {template.content.primaryText && (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <label className="text-sm font-medium">Primary Text</label>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => copyToClipboard(template.content.primaryText!, 'Primary Text')}
                                    >
                                      {copiedField === 'Primary Text' ? (
                                        <CheckCircle className="h-4 w-4 text-green-600" />
                                      ) : (
                                        <Copy className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </div>
                                  <div className="p-3 bg-secondary rounded-md text-sm whitespace-pre-wrap">
                                    {template.content.primaryText}
                                  </div>
                                </div>
                              )}

                              {template.content.body && (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <label className="text-sm font-medium">Body</label>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => copyToClipboard(template.content.body!, 'Body')}
                                    >
                                      {copiedField === 'Body' ? (
                                        <CheckCircle className="h-4 w-4 text-green-600" />
                                      ) : (
                                        <Copy className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </div>
                                  <div className="p-3 bg-secondary rounded-md text-sm whitespace-pre-wrap">
                                    {template.content.body}
                                  </div>
                                </div>
                              )}

                              {template.content.cta && (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <label className="text-sm font-medium">Call-to-Action</label>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => copyToClipboard(template.content.cta!, 'CTA')}
                                    >
                                      {copiedField === 'CTA' ? (
                                        <CheckCircle className="h-4 w-4 text-green-600" />
                                      ) : (
                                        <Copy className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </div>
                                  <div className="p-3 bg-secondary rounded-md text-sm">
                                    {template.content.cta}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Campaign Details */}
                            <div className="space-y-3 border-t pt-4">
                              <h3 className="font-semibold text-lg">Campaign Details</h3>
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <p className="text-muted-foreground">Target Audience</p>
                                  <p className="font-medium">{template.targetAudience}</p>
                                </div>
                                {template.estimatedBudget && (
                                  <div>
                                    <p className="text-muted-foreground">Estimated Budget</p>
                                    <p className="font-medium">{template.estimatedBudget}</p>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Platform Instructions */}
                            {platformInstructions[template.platform as keyof typeof platformInstructions] && (
                              <div className="space-y-3 border-t pt-4">
                                <h3 className="font-semibold text-lg">
                                  {platformInstructions[template.platform as keyof typeof platformInstructions].title}
                                </h3>
                                <ol className="list-decimal list-inside space-y-2 text-sm">
                                  {platformInstructions[template.platform as keyof typeof platformInstructions].steps.map((step, idx) => (
                                    <li key={idx}>{step}</li>
                                  ))}
                                </ol>
                              </div>
                            )}

                            {/* Launch Button */}
                            <div className="flex justify-end gap-3 border-t pt-4">
                              <Button
                                className="bg-[#ff6b35] hover:bg-[#ff6b35]/90"
                                onClick={() => window.open(platformLinks[template.platform as keyof typeof platformLinks], '_blank')}
                              >
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Open {template.platform.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge className={getCategoryColor(template.category)}>
                        {template.category}
                      </Badge>
                      <Badge className={getPlatformColor(template.platform)}>
                        {template.platform}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-3">{template.targetAudience}</p>
                    {template.estimatedBudget && (
                      <p className="text-xs text-muted-foreground">Budget: {template.estimatedBudget}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
