import React from 'react';
import { Smartphone, Package, Star } from 'lucide-react';
import { Tabs, TabList, TabPanels } from '../../components/ui/Tabs';
import { Tab, TabPanel } from '../../components/ui/Tab';
import { ShareTabButton } from '../../components/ShareTabButton';

/**
 * Página de exemplo para testar sistema de abas dinâmicas
 * URL: /test-tabs
 */
export const TabsTestPage: React.FC = () => {
    return (
        <div className="max-w-6xl mx-auto p-6">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">
                            Sistema de Abas Dinâmicas
                        </h1>
                        <p className="text-gray-600 mt-2">
                            Teste de abas com URLs compartilháveis
                        </p>
                    </div>
                    <ShareTabButton
                        title="Confira nosso sistema de abas!"
                        description="Sistema moderno de abas com compartilhamento"
                        showQRCode
                    />
                </div>
            </div>

            {/* Tabs */}
            <Tabs urlParam="categoria" defaultTab="todos">
                <TabList className="mb-6">
                    <Tab id="todos" label="Todos os Produtos" />
                    <Tab id="celulares" label="Celulares" icon={<Smartphone size={18} />} />
                    <Tab id="acessorios" label="Acessórios" icon={<Package size={18} />} />
                    <Tab id="promocoes" label="Promoções" icon={<Star size={18} />} />
                </TabList>

                <TabPanels>
                    <TabPanel id="todos">
                        <div className="bg-white rounded-lg shadow-sm border p-6">
                            <h2 className="text-2xl font-semibold mb-4">Todos os Produtos</h2>
                            <p className="text-gray-600 mb-4">
                                Aqui você encontra todos os nossos produtos disponíveis.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {[1, 2, 3, 4, 5, 6].map((item) => (
                                    <div key={item} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                                        <div className="bg-gray-200 h-40 rounded mb-3"></div>
                                        <h3 className="font-semibold">Produto {item}</h3>
                                        <p className="text-sm text-gray-600">R$ 999,00</p>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-6">
                                <ShareTabButton
                                    title="Confira todos os nossos produtos!"
                                    description="Veja nossa linha completa de produtos"
                                />
                            </div>
                        </div>
                    </TabPanel>

                    <TabPanel id="celulares">
                        <div className="bg-white rounded-lg shadow-sm border p-6">
                            <h2 className="text-2xl font-semibold mb-4">Celulares</h2>
                            <p className="text-gray-600 mb-4">
                                Confira nossa linha completa de smartphones.
                            </p>

                            {/* Sub-abas de marcas */}
                            <Tabs urlParam="marca" defaultTab="samsung">
                                <TabList className="mb-4">
                                    <Tab id="samsung" label="Samsung" />
                                    <Tab id="apple" label="Apple" />
                                    <Tab id="xiaomi" label="Xiaomi" />
                                </TabList>

                                <TabPanels>
                                    <TabPanel id="samsung">
                                        <div className="p-4 bg-blue-50 rounded-lg">
                                            <h3 className="font-semibold text-lg mb-2">Samsung</h3>
                                            <p className="text-gray-600 mb-4">
                                                Smartphones Samsung com tecnologia de ponta.
                                            </p>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {['Galaxy S24', 'Galaxy A54', 'Galaxy Z Flip'].map((model) => (
                                                    <div key={model} className="bg-white border rounded-lg p-4">
                                                        <div className="bg-gray-200 h-32 rounded mb-2"></div>
                                                        <h4 className="font-semibold">{model}</h4>
                                                        <p className="text-sm text-gray-600">R$ 2.999,00</p>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="mt-4">
                                                <ShareTabButton
                                                    title="Confira os celulares Samsung!"
                                                    description="Smartphones Samsung com tecnologia de ponta"
                                                />
                                            </div>
                                        </div>
                                    </TabPanel>

                                    <TabPanel id="apple">
                                        <div className="p-4 bg-gray-50 rounded-lg">
                                            <h3 className="font-semibold text-lg mb-2">Apple</h3>
                                            <p className="text-gray-600 mb-4">
                                                iPhones com o melhor da tecnologia Apple.
                                            </p>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {['iPhone 15 Pro', 'iPhone 15', 'iPhone 14'].map((model) => (
                                                    <div key={model} className="bg-white border rounded-lg p-4">
                                                        <div className="bg-gray-200 h-32 rounded mb-2"></div>
                                                        <h4 className="font-semibold">{model}</h4>
                                                        <p className="text-sm text-gray-600">R$ 6.999,00</p>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="mt-4">
                                                <ShareTabButton
                                                    title="Confira os iPhones!"
                                                    description="iPhones com o melhor da tecnologia Apple"
                                                />
                                            </div>
                                        </div>
                                    </TabPanel>

                                    <TabPanel id="xiaomi">
                                        <div className="p-4 bg-orange-50 rounded-lg">
                                            <h3 className="font-semibold text-lg mb-2">Xiaomi</h3>
                                            <p className="text-gray-600 mb-4">
                                                Smartphones Xiaomi com ótimo custo-benefício.
                                            </p>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {['Redmi Note 13', 'Poco X6', 'Mi 13'].map((model) => (
                                                    <div key={model} className="bg-white border rounded-lg p-4">
                                                        <div className="bg-gray-200 h-32 rounded mb-2"></div>
                                                        <h4 className="font-semibold">{model}</h4>
                                                        <p className="text-sm text-gray-600">R$ 1.499,00</p>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="mt-4">
                                                <ShareTabButton
                                                    title="Confira os celulares Xiaomi!"
                                                    description="Smartphones Xiaomi com ótimo custo-benefício"
                                                />
                                            </div>
                                        </div>
                                    </TabPanel>
                                </TabPanels>
                            </Tabs>
                        </div>
                    </TabPanel>

                    <TabPanel id="acessorios">
                        <div className="bg-white rounded-lg shadow-sm border p-6">
                            <h2 className="text-2xl font-semibold mb-4">Acessórios</h2>
                            <p className="text-gray-600 mb-4">
                                Capinhas, fones, carregadores e muito mais.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                {['Capinha', 'Fone Bluetooth', 'Carregador', 'Película'].map((item) => (
                                    <div key={item} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                                        <div className="bg-gray-200 h-32 rounded mb-3"></div>
                                        <h3 className="font-semibold">{item}</h3>
                                        <p className="text-sm text-gray-600">R$ 49,90</p>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-6">
                                <ShareTabButton
                                    title="Confira nossos acessórios!"
                                    description="Capinhas, fones, carregadores e muito mais"
                                />
                            </div>
                        </div>
                    </TabPanel>

                    <TabPanel id="promocoes">
                        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg shadow-sm border p-6">
                            <h2 className="text-2xl font-semibold mb-4 text-orange-900">🔥 Promoções Imperdíveis</h2>
                            <p className="text-gray-700 mb-4">
                                Aproveite nossas ofertas especiais!
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {[
                                    { name: 'Galaxy A54', oldPrice: 'R$ 2.499', newPrice: 'R$ 1.999' },
                                    { name: 'iPhone 14', oldPrice: 'R$ 5.999', newPrice: 'R$ 4.999' },
                                    { name: 'Redmi Note 13', oldPrice: 'R$ 1.799', newPrice: 'R$ 1.299' }
                                ].map((promo) => (
                                    <div key={promo.name} className="bg-white border-2 border-orange-300 rounded-lg p-4 hover:shadow-lg transition-shadow">
                                        <div className="bg-gradient-to-br from-orange-200 to-yellow-200 h-40 rounded mb-3 flex items-center justify-center">
                                            <span className="text-4xl">🎁</span>
                                        </div>
                                        <h3 className="font-semibold text-lg">{promo.name}</h3>
                                        <p className="text-sm text-gray-500 line-through">{promo.oldPrice}</p>
                                        <p className="text-xl font-bold text-orange-600">{promo.newPrice}</p>
                                        <span className="inline-block mt-2 px-3 py-1 bg-orange-500 text-white text-xs rounded-full">
                                            -20% OFF
                                        </span>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-6">
                                <ShareTabButton
                                    title="🔥 Promoções Imperdíveis!"
                                    description="Aproveite nossas ofertas especiais com até 20% de desconto"
                                />
                            </div>
                        </div>
                    </TabPanel>
                </TabPanels>
            </Tabs>

            {/* Instruções */}
            <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="font-semibold text-blue-900 mb-2">💡 Como testar:</h3>
                <ul className="list-disc list-inside text-blue-800 space-y-1">
                    <li>Clique nas abas e veja a URL mudar</li>
                    <li>Copie a URL e abra em outra aba - deve abrir direto na aba correta</li>
                    <li>Clique em "Compartilhar" para testar compartilhamento</li>
                    <li>Use os botões voltar/avançar do navegador</li>
                    <li>Teste as sub-abas dentro de "Celulares"</li>
                </ul>
            </div>
        </div>
    );
};
