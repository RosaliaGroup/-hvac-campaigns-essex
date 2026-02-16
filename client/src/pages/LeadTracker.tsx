import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Phone, Mail, User, Calendar, TrendingUp, Download } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { getLoginUrl } from "@/const";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

interface Lead {
  id: string;
  name: string;
  contact: string;
  contactType: "phone" | "email";
  source: string;
  service: string;
  status: "new" | "contacted" | "quoted" | "won" | "lost";
  notes: string;
  date: string;
}

export default function LeadTracker() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    contact: "",
    contactType: "phone" as "phone" | "email",
    source: "",
    service: "",
    status: "new" as Lead["status"],
    notes: "",
  });

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      window.location.href = getLoginUrl();
    }
  }, [loading, isAuthenticated]);

  // Load leads from localStorage
  useEffect(() => {
    const savedLeads = localStorage.getItem("hvac-leads");
    if (savedLeads) {
      setLeads(JSON.parse(savedLeads));
    }
  }, []);

  // Save leads to localStorage
  const saveLeads = (newLeads: Lead[]) => {
    setLeads(newLeads);
    localStorage.setItem("hvac-leads", JSON.stringify(newLeads));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newLead: Lead = {
      id: Date.now().toString(),
      ...formData,
      date: new Date().toISOString(),
    };

    saveLeads([newLead, ...leads]);
    
    // Reset form
    setFormData({
      name: "",
      contact: "",
      contactType: "phone",
      source: "",
      service: "",
      status: "new",
      notes: "",
    });
    setShowForm(false);
  };

  const updateLeadStatus = (leadId: string, newStatus: Lead["status"]) => {
    const updatedLeads = leads.map(lead =>
      lead.id === leadId ? { ...lead, status: newStatus } : lead
    );
    saveLeads(updatedLeads);
  };

  const exportToCSV = () => {
    const headers = ["Date", "Name", "Contact", "Source", "Service", "Status", "Notes"];
    const rows = leads.map(lead => [
      new Date(lead.date).toLocaleDateString(),
      lead.name,
      lead.contact,
      lead.source,
      lead.service,
      lead.status,
      lead.notes.replace(/,/g, ";") // Replace commas to avoid CSV issues
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hvac-leads-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff6b35]"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  // Calculate stats
  const stats = {
    total: leads.length,
    new: leads.filter(l => l.status === "new").length,
    contacted: leads.filter(l => l.status === "contacted").length,
    won: leads.filter(l => l.status === "won").length,
    conversionRate: leads.length > 0 ? ((leads.filter(l => l.status === "won").length / leads.length) * 100).toFixed(1) : "0",
  };

  const getStatusBadge = (status: Lead["status"]) => {
    const variants = {
      new: "bg-blue-100 text-blue-800",
      contacted: "bg-yellow-100 text-yellow-800",
      quoted: "bg-purple-100 text-purple-800",
      won: "bg-green-100 text-green-800",
      lost: "bg-gray-100 text-gray-800",
    };
    return <Badge className={variants[status]}>{status.toUpperCase()}</Badge>;
  };

  return (
    <div className="min-h-screen bg-secondary/30">
      <Navigation />
      
      <div className="container py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-[#1e3a5f] mb-2">Lead Tracker</h1>
            <p className="text-muted-foreground">Track and manage incoming leads from all campaigns</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={exportToCSV} disabled={leads.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button 
              className="bg-[#ff6b35] hover:bg-[#ff6b35]/90"
              onClick={() => setShowForm(!showForm)}
            >
              {showForm ? "Cancel" : "+ Add Lead"}
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-5 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Leads</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">New</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-blue-600">{stats.new}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Contacted</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-yellow-600">{stats.contacted}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Won</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-600">{stats.won}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Conversion Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold flex items-center gap-2">
                {stats.conversionRate}%
                <TrendingUp className="h-5 w-5 text-green-600" />
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Add Lead Form */}
        {showForm && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Add New Lead</CardTitle>
              <CardDescription>Log a new lead from phone call or form submission</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="name"
                        placeholder="John Smith"
                        className="pl-10"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contact">Contact (Phone or Email) *</Label>
                    <div className="relative">
                      {formData.contactType === "phone" ? (
                        <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      )}
                      <Input
                        id="contact"
                        placeholder={formData.contactType === "phone" ? "(862) 555-1234" : "john@example.com"}
                        className="pl-10"
                        value={formData.contact}
                        onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contactType">Contact Type *</Label>
                    <Select
                      value={formData.contactType}
                      onValueChange={(value: "phone" | "email") => setFormData({ ...formData, contactType: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="phone">Phone</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="source">Lead Source *</Label>
                    <Select
                      value={formData.source}
                      onValueChange={(value) => setFormData({ ...formData, source: value })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select source" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Google Ads - Search">Google Ads - Search</SelectItem>
                        <SelectItem value="Google Ads - Display">Google Ads - Display</SelectItem>
                        <SelectItem value="Google Business Profile">Google Business Profile</SelectItem>
                        <SelectItem value="Facebook Ads">Facebook Ads</SelectItem>
                        <SelectItem value="Instagram Ads">Instagram Ads</SelectItem>
                        <SelectItem value="YouTube Ads">YouTube Ads</SelectItem>
                        <SelectItem value="Nextdoor">Nextdoor</SelectItem>
                        <SelectItem value="Website - Organic">Website - Organic</SelectItem>
                        <SelectItem value="Website - Contact Form">Website - Contact Form</SelectItem>
                        <SelectItem value="Referral">Referral</SelectItem>
                        <SelectItem value="Partner">Partner</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="service">Service Interested In *</Label>
                    <Select
                      value={formData.service}
                      onValueChange={(value) => setFormData({ ...formData, service: value })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select service" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Emergency Repair">Emergency Repair</SelectItem>
                        <SelectItem value="Heat Pump Installation">Heat Pump Installation</SelectItem>
                        <SelectItem value="AC Installation">AC Installation</SelectItem>
                        <SelectItem value="Heating Installation">Heating Installation</SelectItem>
                        <SelectItem value="Maintenance Subscription">Maintenance Subscription</SelectItem>
                        <SelectItem value="Commercial HVAC">Commercial HVAC</SelectItem>
                        <SelectItem value="VRF/VRV Systems">VRF/VRV Systems</SelectItem>
                        <SelectItem value="Rebate Consultation">Rebate Consultation</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="status">Status *</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value: Lead["status"]) => setFormData({ ...formData, status: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="contacted">Contacted</SelectItem>
                        <SelectItem value="quoted">Quoted</SelectItem>
                        <SelectItem value="won">Won</SelectItem>
                        <SelectItem value="lost">Lost</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder="Additional details about the lead..."
                    rows={3}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>

                <Button type="submit" className="w-full bg-[#ff6b35] hover:bg-[#ff6b35]/90">
                  Save Lead
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Leads Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Leads</CardTitle>
            <CardDescription>
              {leads.length === 0 ? "No leads yet. Add your first lead above." : `${leads.length} total leads`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {leads.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Service</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leads.map((lead) => (
                      <TableRow key={lead.id}>
                        <TableCell className="whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {new Date(lead.date).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{lead.name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {lead.contactType === "phone" ? (
                              <Phone className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Mail className="h-4 w-4 text-muted-foreground" />
                            )}
                            {lead.contact}
                          </div>
                        </TableCell>
                        <TableCell>{lead.source}</TableCell>
                        <TableCell>{lead.service}</TableCell>
                        <TableCell>{getStatusBadge(lead.status)}</TableCell>
                        <TableCell className="max-w-xs truncate">{lead.notes || "-"}</TableCell>
                        <TableCell>
                          <Select
                            value={lead.status}
                            onValueChange={(value: Lead["status"]) => updateLeadStatus(lead.id, value)}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="new">New</SelectItem>
                              <SelectItem value="contacted">Contacted</SelectItem>
                              <SelectItem value="quoted">Quoted</SelectItem>
                              <SelectItem value="won">Won</SelectItem>
                              <SelectItem value="lost">Lost</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <User className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-semibold mb-2">No leads yet</p>
                <p className="text-sm">Click "+ Add Lead" above to log your first lead</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Footer />
    </div>
  );
}
